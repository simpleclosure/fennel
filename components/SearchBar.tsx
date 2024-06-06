import Error from "@/components/Error";
import { StateDropdown } from "@/components/StateDropdown";
import { STATES } from "@/lib/consts";
import Image from "next/image";
import { FormEvent } from "react";

type SearchBarProps = {
  handleFormSubmit: (e: FormEvent) => Promise<void>;
  hasError: () => any;
  handleFocus: () => void;
  isFocused?: boolean;
  setIsFocused: (val: boolean) => void;
  setCompanyName: (val: string) => void;
  companyName: string;
  errors: {
    [key: string]: any;
  };
  selectedState: string;
  handleStateChange: (value: any) => void;
  hasOutline?: boolean;
  classes?: { wrapper?: string; helperText?: string };
};

export default function SearchBar({
  handleFormSubmit,
  hasError,
  handleFocus,
  isFocused = true,
  setIsFocused,
  setCompanyName,
  companyName,
  errors,
  selectedState,
  handleStateChange,
}: SearchBarProps) {
  return (
    <div className="flex w-full h-fit flex-col justify-start gap-0.5">
      <form
        onSubmit={handleFormSubmit}
        id="input-container"
        className={`flex border border-gray flex-nowrap items-center gap-2 text-gray-dark rounded-full py-2 pl-6 pr-2 ${
          hasError() ? "border border-[#CF3F3F]" : ""
        }`}
      >
        <div className="flex w-full items-center h-full">
          <input
            name="company_name"
            autoComplete="off"
            onFocus={handleFocus}
            onBlur={() => setIsFocused(false)}
            onChange={(e) => setCompanyName(e.target.value)}
            value={companyName}
            type="text"
            placeholder="Enter Company Name"
            className={`w-full h-full flex-grow text-[17px] placeholder:text-[#666] focus:outline-none active:outline-none ${
              errors.companyName ? "placeholder:text-[#CF3F3F]" : ""
            }`}
          />
          <div className="flex items-center min-w-[250px] border-l-[1px] border-inactive h-full">
            <StateDropdown
              name="state"
              placeholder="State of Incorporation"
              options={STATES}
              value={selectedState}
              hasError={!!errors.state}
              changed={handleStateChange}
            />
          </div>
        </div>
        <button
          type="submit"
          className="h-[54px] min-w-[54px] flex items-center justify-center rounded-full bg-primary hover:bg-primary-light active:bg-primary-dark
          "
        >
          <Image src="/search.svg" alt="search" width={25} height={26} />
        </button>
      </form>
      {isFocused && !hasError() ? (
        <p className="pl-6 text-[15px] leading-[1.6] text-gray cursor-default">
          Please enter company&apos;s full legal name to ensure accurate results
        </p>
      ) : (
        <div className="flex w-[calc(100%-70px)] h-fit items-center cursor-default">
          <div className="flex w-full pl-6">
            {errors.companyName && <Error>{errors.companyName}</Error>}
          </div>
          <div className="flex pl-4 min-w-[250px]">
            {errors.state && <Error>{errors.state}</Error>}
          </div>
        </div>
      )}
    </div>
  );
}
