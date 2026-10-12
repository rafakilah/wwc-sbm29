export type ActionState = {
  ok: boolean;
  message: string | null;
  code?: string;
  fieldErrors?: Record<string, string>;
};

export const initialActionState: ActionState = { ok: false, message: null };
