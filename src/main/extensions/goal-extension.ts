import type { TSchema } from "@sinclair/typebox";
import { Type } from "@sinclair/typebox";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type {
  AgentRuntimeExtension,
  AgentRuntimeCustomTool,
  BeforeSessionRunContext,
  BeforeSessionRunResult,
  AfterSessionRunContext,
  AfterSessionRunResult,
  CommandContext,
  CommandResult,
  SessionDeletedContext,
} from "./agent-runtime-extension";

// ─── Types ───────────────────────────────────────────────────────────

type GoalStatus = "active" | "paused" | "complete" | "cleared";

interface GoalState {
  objective: string;
  status: GoalStatus;
  iteration: number;
  firstTurnDone: boolean;
  tokenBudget?: number;
  tokensUsed: number;
  startedAt: number;
  endedAt?: number;
}

// ─── Prompt templates ────────────────────────────────────────────────

function buildGoalSystemPrompt(goal: GoalState): string {
  const budgetLine = goal.tokenBudget
    ? `Token budget: ${Math.round(goal.tokensUsed).toLocaleString()} / ${goal.tokenBudget.toLocaleString()}`
    : "No token budget set.";
  return `# Active Goal
You are working toward the following objective:
<goal_objective>${goal.objective}</goal_objective>
${budgetLine}
When you have completed the objective, call the \`goal_complete\` tool with a brief summary.
Do not mark the goal as complete unless you have verified the actual outcome.`;
}

function buildContinuePrompt(goal: GoalState): string {
  return `Continue working toward the active goal.
<goal_objective>${goal.objective}</goal_objective>
This is automatic continuation #${goal.iteration}.
- Make concrete progress toward the objective.
- Verify completion against the actual current state before calling goal_complete.
- If you encounter a persistent obstacle, call goal_complete with a description of what remains.`;
}

function buildStartPrompt(goal: GoalState): string {
  return `Work toward the following goal:
<goal_objective>${goal.objective}</goal_objective>
Make concrete progress. When done, call the \`goal_complete\` tool.`;
}

function buildResumePrompt(goal: GoalState): string {
  return `Resume working toward the active goal:
<goal_objective>${goal.objective}</goal_objective>
This is turn #${goal.iteration}. Pick up where you left off.`;
}

// ─── Goal complete tool ──────────────────────────────────────────────

const GoalCompleteSchema = Type.Object({
  summary: Type.String({
    description: "Brief summary of what was accomplished.",
  }),
});

type GoalCompleteInput = { summary: string };

// ─── Extension ───────────────────────────────────────────────────────

export class GoalExtension implements AgentRuntimeExtension {
  readonly name = "goal";

  /** Goal state keyed by sessionId, so multiple sessions do not interfere. */
  private goals: Map<string, GoalState> = new Map();

  /**
   * Per-session goal_complete tool.
   * Each tool captures its own sessionId in the execute closure so the
   * correct goal is completed regardless of which session the Agent runs in.
   */
  private goalCompleteTools: Map<string, AgentRuntimeCustomTool> = new Map();

  // ── helpers ──────────────────────────────────────────────────────

  private getGoal(sessionId: string): GoalState | undefined {
    return this.goals.get(sessionId);
  }

  private setGoal(sessionId: string, goal: GoalState): void {
    this.goals.set(sessionId, goal);
  }

  private deleteGoal(sessionId: string): void {
    this.goals.delete(sessionId);
    this.goalCompleteTools.delete(sessionId);
  }

  private updateGoalUsage(sessionId: string, ctx: AfterSessionRunContext): void {
    const goal = this.getGoal(sessionId);
    if (!goal) return;

    let total = 0;
    for (const msg of ctx.messages) {
      if (msg.role === "assistant" && msg.tokenUsage) {
        total += msg.tokenUsage.input ?? 0;
        total += msg.tokenUsage.output ?? 0;
      }
    }
    goal.tokensUsed = total;
  }

  private goalStatusPayload(
    goal?: GoalState,
  ): { goalStatus: NonNullable<AfterSessionRunResult["goalStatus"]> } {
    if (!goal) {
      return { goalStatus: { status: "cleared" } };
    }
    return {
      goalStatus: {
        status: goal.status,
        objective: goal.objective,
        iteration: goal.iteration,
        tokensUsed: goal.tokensUsed,
        tokenBudget: goal.tokenBudget,
      },
    };
  }

  /** Ensure a per-session goal_complete tool exists, creating it if needed. */
  private ensureGoalCompleteTool(sessionId: string): AgentRuntimeCustomTool {
    let tool = this.goalCompleteTools.get(sessionId);
    if (!tool) {
      const sid = sessionId; // capture for closure
      tool = {
        name: "goal_complete",
        label: "Goal Complete",
        description:
          "Mark the active goal as complete. Call this when you have verified the goal objective has been achieved.",
        parameters: GoalCompleteSchema as TSchema,
        execute: async (
          _toolCallId: string,
          params: unknown,
          _signal: AbortSignal | undefined,
          _onUpdate: unknown,
          _ctx: ExtensionContext,
        ) => {
          const parsed = params as GoalCompleteInput;
          const text = await this.executeGoalComplete(sid, parsed);
          return { content: [{ type: "text" as const, text }], details: {} };
        },
      };
      this.goalCompleteTools.set(sid, tool);
    }
    return tool;
  }

  // ── goal_complete tool execution ─────────────────────────────────

  private async executeGoalComplete(
    sessionId: string,
    input: GoalCompleteInput,
  ): Promise<string> {
    const goal = this.getGoal(sessionId);
    if (!goal || goal.status !== "active") {
      return "There is no active goal to complete.";
    }
    goal.status = "complete";
    goal.endedAt = Date.now();
    return `Goal marked as complete. Summary: ${input.summary}`;
  }

  // ── commands ─────────────────────────────────────────────────────

  private showStatus(sessionId: string): CommandResult {
    const goal = this.getGoal(sessionId);
    if (!goal || goal.status === "cleared") {
      return { handled: true, message: "No active goal." };
    }

    const budgetStr = goal.tokenBudget
      ? ` | token: ${Math.round(goal.tokensUsed).toLocaleString()} / ${goal.tokenBudget.toLocaleString()}`
      : "";

    const statusMap: Record<GoalStatus, string> = {
      active: `🎯 Goal active (turn ${goal.iteration}): ${goal.objective}${budgetStr}`,
      paused: `⏸ Goal paused: ${goal.objective}`,
      complete: `✅ Goal complete: ${goal.objective}`,
      cleared: "No active goal.",
    };

    return {
      handled: true,
      message: statusMap[goal.status],
      goalStatus: this.goalStatusPayload(goal).goalStatus,
    };
  }

  private startGoal(
    sessionId: string,
    objective: string,
    tokenBudget?: number,
  ): CommandResult {
    const normalized = objective.trim();
    if (!normalized) {
      return { handled: true, message: "Please provide a goal objective." };
    }

    const existing = this.getGoal(sessionId);
    if (existing?.status === "active") {
      // Overwrite active goal
    }

    const goal: GoalState = {
      objective: normalized,
      status: "active",
      iteration: 1,
      firstTurnDone: false,
      tokenBudget,
      tokensUsed: 0,
      startedAt: Date.now(),
    };
    this.setGoal(sessionId, goal);

    const firstTurnPrompt = buildStartPrompt(goal);
    const budgetNote = tokenBudget
      ? ` (token budget: ${tokenBudget.toLocaleString()})`
      : "";

    return {
      handled: true,
      message: `Goal started: ${normalized}${budgetNote}`,
      firstTurnPrompt,
      goalStatus: this.goalStatusPayload(goal).goalStatus,
    };
  }

  private pauseGoal(sessionId: string): CommandResult {
    const goal = this.getGoal(sessionId);
    if (!goal || goal.status !== "active") {
      return { handled: true, message: "No active goal to pause." };
    }
    goal.status = "paused";
    return {
      handled: true,
      message: `Goal paused: ${goal.objective}`,
      goalStatus: this.goalStatusPayload(goal).goalStatus,
    };
  }

  private resumeGoal(sessionId: string): CommandResult {
    const goal = this.getGoal(sessionId);
    if (!goal) {
      return { handled: true, message: "No goal to resume." };
    }
    if (goal.status === "complete" || goal.status === "cleared") {
      return {
        handled: true,
        message: `Goal is ${goal.status}; start a new one with /goal <objective>.`,
      };
    }
    if (goal.status === "active") {
      return { handled: true, message: "Goal is already active." };
    }

    goal.status = "active";
    const firstTurnPrompt = buildResumePrompt(goal);
    return {
      handled: true,
      message: `Goal resumed: ${goal.objective}`,
      firstTurnPrompt,
      goalStatus: this.goalStatusPayload(goal).goalStatus,
    };
  }

  private clearGoal(sessionId: string): CommandResult {
    const goal = this.getGoal(sessionId);
    if (!goal) {
      return { handled: true, message: "No goal to clear." };
    }
    this.deleteGoal(sessionId);
    return {
      handled: true,
      message: `Goal cleared.`,
      goalStatus: { status: "cleared" },
    };
  }

  // ── public lifecycle hooks ───────────────────────────────────────

  async onCommand(context: CommandContext): Promise<CommandResult | void> {
    const { args, sessionId } = context;

    if (!args.trim()) {
      return this.showStatus(sessionId);
    }

    if (args.trim() === "pause") {
      return this.pauseGoal(sessionId);
    }

    if (args.trim() === "resume") {
      return this.resumeGoal(sessionId);
    }

    if (args.trim() === "clear") {
      return this.clearGoal(sessionId);
    }

    const tokensMatch = args.match(
      /^--tokens\s+(\d+(?:\.?\d*)?[km]?)\s+(.+)/i,
    );
    if (tokensMatch) {
      const budget = parseTokenBudget(tokensMatch[1]);
      return this.startGoal(sessionId, tokensMatch[2].trim(), budget);
    }

    return this.startGoal(sessionId, args.trim());
  }

  async beforeSessionRun(
    ctx: BeforeSessionRunContext,
  ): Promise<BeforeSessionRunResult | void> {
    const sessionId = ctx.session.id;
    const goal = this.getGoal(sessionId);
    if (!goal || goal.status !== "active") {
      return;
    }

    // Increment iteration at the start of continuation turns.
    if (goal.firstTurnDone) {
      goal.iteration++;
    }
    goal.firstTurnDone = true;

    const promptPrefix = buildGoalSystemPrompt(goal);
    const tool = this.ensureGoalCompleteTool(sessionId);
    return { promptPrefix, customTools: [tool] };
  }

  async afterSessionRun(
    ctx: AfterSessionRunContext,
  ): Promise<AfterSessionRunResult | void> {
    const sessionId = ctx.session.id;
    const goal = this.getGoal(sessionId);

    if (!goal || goal.status !== "active") {
      if (goal?.status === "complete") {
        const payload = this.goalStatusPayload(goal);
        // Delete after reporting so completed status is not re-broadcast
        // on every subsequent turn / user message in this session.
        this.deleteGoal(sessionId);
        return payload;
      }
      if (goal?.status === "cleared") {
        this.deleteGoal(sessionId);
      }
      return;
    }

    this.updateGoalUsage(sessionId, ctx);

    if (
      goal.tokenBudget !== undefined &&
      goal.tokensUsed >= goal.tokenBudget
    ) {
      goal.status = "paused";
      return this.goalStatusPayload(goal);
    }

    if (goal.status !== "active") {
      return this.goalStatusPayload(goal);
    }

    const continuePrompt = buildContinuePrompt(goal);
    return { continuePrompt, ...this.goalStatusPayload(goal) };
  }

  async onSessionDeleted(context: SessionDeletedContext): Promise<void> {
    this.deleteGoal(context.sessionId);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────

function parseTokenBudget(raw: string): number | undefined {
  const normalized = raw.trim().toLowerCase();
  const num = parseFloat(normalized);
  if (isNaN(num)) return undefined;
  if (normalized.endsWith("k")) return Math.round(num * 1_000);
  if (normalized.endsWith("m")) return Math.round(num * 1_000_000);
  return Math.round(num);
}
