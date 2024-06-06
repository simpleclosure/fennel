import { CompanyMatch, Responses } from "@/lib/types";
import { FormEvent, useState } from "react";

const ENDPOINT = "https://state-search-dev-efp4xgij4q-uc.a.run.app";

export function useEntitySearch() {
  const [isFocused, setIsFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: any }>({});
  const [response, setResponse] = useState<Responses>(null);
  const [companyName, setCompanyName] = useState<string>("");
  const [selectedState, setSelectedState] = useState<string>("");
  const [searchedCompany, setSearchedCompany] = useState<string>("");
  const [selectedEntity, setSelectedEntity] = useState<CompanyMatch>();

  const handleStateChange = (value: any) => {
    setSelectedState(value.state);

    if (errors.state) {
      setErrors((errors) => ({
        ...errors,
        state: "",
      }));
    }
  };

  const hasError = () => {
    return errors.companyName || errors.state;
  };

  const handleSearch = async (name: string) => {
    setResponse(null);
    setIsLoading(true);
    setSearchedCompany(name);
    setSelectedEntity(undefined);

    const URL = `${ENDPOINT}?name=${companyName}&state=${selectedState.toLowerCase()}`;

    await fetch(URL, { method: "GET" })
      .then((res) => res.json())
      .then((data) => setResponse(data))
      .catch((error) => console.error(error))
      .finally(() => {
        setIsLoading(false);
      });
  };

  const handleFormSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (companyName && selectedState && !isLoading) {
      await handleSearch(companyName);
    } else {
      if (!companyName)
        setErrors((errors) => ({
          ...errors,
          companyName: "Please enter full company name",
        }));
      if (!selectedState)
        setErrors((errors) => ({
          ...errors,
          state: "Please select state from list",
        }));
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
    setErrors({});
  };

  return {
    isFocused,
    companyName,
    selectedEntity,
    errors,
    response,
    selectedState,
    searchedCompany,
    isLoading,
    setIsFocused,
    setCompanyName,
    setSelectedEntity,
    handleStateChange,
    hasError,
    handleFormSubmit,
    handleFocus,
    handleSearch,
  };
}
