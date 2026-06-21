/** Built-in slash commands for the chat input. */
export interface SlashCommand {
  name: string;
  label: string;
  description: string;
  action: "compact" | "goal";
}

export const BUILTIN_COMMANDS: SlashCommand[] = [
  {
    name: "compact",
    label: "压缩会话",
    description: "手动压缩当前会话上下文",
    action: "compact",
  },
  {
    name: "goal",
    label: "目标执行",
    description: "设定目标，由 Agent 自主循环执行直到完成",
    action: "goal",
  },
];
