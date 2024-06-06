import { STATES } from "./consts";

export const getStateName = (stateShorthand: string): string => {
  const state = STATES.find((s) => {
    return s.value === stateShorthand.toUpperCase();
  });

  if (!state) throw new Error(`State not found for ${stateShorthand}`);

  return state.label;
};

export const extractYearFromDate = (dateString: string | null) => {
  if (!dateString) return "-";

  const date = new Date(dateString);
  return date.getFullYear();
};
