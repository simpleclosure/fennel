export interface NotFoundResponse {
  status: "not_found";
}

export interface FuzzyResponse {
  status: "fuzzy";
  names: CompanyMatch[];
}

export type ExactResponse = CompanyMatch & {
  status: "exact";
  states: string[];
  additional: number;
};

export interface TooManyResponse {
  status: "too_many";
}

export type CompanyMatch = {
  name: string;
  date: string;
  type: string;
};

export type Responses =
  | NotFoundResponse
  | FuzzyResponse
  | ExactResponse
  | TooManyResponse
  | null;
