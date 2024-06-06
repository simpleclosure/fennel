"use client";

import Button from "@/components/Button";
import SearchBar from "@/components/SearchBar";
import { useEntitySearch } from "@/hooks/useEntitySearch";
import { STATES } from "@/lib/consts";
import { CompanyMatch, ExactResponse, FuzzyResponse } from "@/lib/types";
import { extractYearFromDate } from "@/lib/utils";
import Image from "next/image";
import { ReactNode, useEffect } from "react";

function Skeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4">
        <div className="animated-load h-[24px] max-w-[50%]" />
        <div className="h-fit w-full flex-col gap-3 flex">
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={`result_${i}`}
              className="animated-load h-[64px] w-full rounded-[20px]"
            />
          ))}
        </div>
      </div>
      <div className="flex w-full justify-end h-[78.5px]">
        <div className="animated-load h-[48px] rounded-full max-w-[212px]" />
      </div>
    </div>
  );
}

function TextSection() {
  return (
    <div className="flex cursor-default flex-col gap-2 text-gray-dark mb-6">
      <p className="text-[15px]">Step 1 of 2</p>
      <div className="flex flex-col">
        <p className="text-[24px] font-semibold text-coal">
          First, let&apos;s find your company
        </p>
        <p className="text-[17px]">
          This ensures that we&apos;re able to work with the most accurate
          information
        </p>
      </div>
    </div>
  );
}

type ButtonSectionProps = {
  isError?: boolean;
  handleConfirm?: () => void;
  handleContinueWithoutMatch: () => void;
  helperText: string;
};

function ButtonSection({
  isError = false,
  handleConfirm,
  handleContinueWithoutMatch,
  helperText,
}: ButtonSectionProps) {
  return (
    <div className="flex h-fit w-full flex-col gap-2">
      <div
        className={`flex w-full items-start ${
          handleConfirm ? "justify-between" : "justify-center"
        }`}
      >
        <div
          onClick={handleContinueWithoutMatch}
          className="flex h-[48px] cursor-pointer items-center px-6 text-[17px] font-medium text-primary-extra-dark underline hover:text-primary-dark active:text-primary"
        >
          Continue with original entry
        </div>
        {handleConfirm && (
          <Button
            label="Continue"
            onClick={handleConfirm}
            className="w-[212px]"
          >
            <Image
              src="/arrow.svg"
              height="12"
              width="19"
              alt="arrow"
              className="w-fit pr-[5px]"
            />
          </Button>
        )}
      </div>
      {isError ? (
        <div className="flex w-full justify-center gap-2">
          <Image src="/error.svg" alt="error" height="14" width="14" />
          <p className="cursor-default text-[15px] font-medium text-[#CF3F3F]">
            Please choose an entity to continue
          </p>
        </div>
      ) : (
        <p className="w-full cursor-default text-center text-[15px] text-gray">
          {helperText}
        </p>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  classes,
}: {
  label: string;
  value: string | number;
  classes: string;
}) {
  return (
    <div className={`flex flex-col text-[15px] ${classes}`}>
      <p className="font-bold text-gray-dark">{value}</p>
      <p className="text-gray">{label}</p>
    </div>
  );
}

function Result({
  name,
  date,
  type,
  state,
  isSelected,
  onClick,
}: {
  name: string;
  date: string;
  type: string;
  state: string;
  isSelected: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`flex w-full cursor-pointer justify-between rounded-[20px] px-4 py-3 h-[64px] items-center ${
        isSelected ? "bg-white ring-[2px] ring-green" : "bg-primary-white"
      } `}
    >
      <p className="font-serif text-[18px] font-semibold text-primary-extra-dark">
        {name}
      </p>
      <div className="flex gap-8 leading-[1.3]">
        <Stat label="Type" value={type} classes="w-[80px]" />
        <Stat
          label="State of incorp."
          value={STATES.find((entry) => entry.value === state)?.label || "NA"}
          classes="w-[105px]"
        />
        <Stat
          label="Year"
          value={extractYearFromDate(date)}
          classes="w-[35px]"
        />
      </div>
    </div>
  );
}

function Disclaimer({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-full flex-col justify-center gap-4 bg-primary-white p-6 h-[292px]">
      {children}
      <ul className="list-inside list-disc text-[17px] leading-relaxed text-gray-dark">
        <li>Check your spelling</li>
        <li>Make sure you have selected the correct state of incorporation</li>
        <li>Re-enter the company&apos;s full legal name</li>
        <li>Add company type, e.g. LLC or Inc.</li>
      </ul>
    </div>
  );
}

function FoundCorporation({
  companyState,
  response,
  setSelectedEntity,
  handleConfirm,
  handleContinueWithoutMatch,
  helperText,
}: ButtonSectionProps & {
  companyState: string;
  response: ExactResponse;
  setSelectedEntity: (entity: CompanyMatch) => void;
}) {
  useEffect(() => {
    const { name, type, date } = response;
    setSelectedEntity({ name, type, date });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4">
        <p className="cursor-default leading-normal text-[16px] text-coal">
          We found a match!
        </p>
        <div className="flex w-full px-[2px] h-[292px]">
          <Result
            name={response.name}
            date={response.date}
            type={response.type}
            state={companyState}
            isSelected={true}
          />
        </div>
      </div>
      <ButtonSection
        handleConfirm={handleConfirm}
        handleContinueWithoutMatch={handleContinueWithoutMatch}
        helperText={helperText}
      />
    </div>
  );
}

function Fuzzy({
  companyName,
  companyState,
  response,
  isError,
  selectedEntity,
  handleSelect,
  handleConfirm,
  handleContinueWithoutMatch,
  helperText,
}: ButtonSectionProps & {
  companyName: string;
  companyState: string;
  response: FuzzyResponse;
  selectedEntity?: CompanyMatch;
  handleSelect: (match: CompanyMatch) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4">
        <p className="cursor-default leading-normal text-[16px] text-coal">
          We found{" "}
          <span className="font-bold text-primary-extra-dark">
            {response.names.length} results
          </span>{" "}
          for &apos;
          <span className="font-bold text-primary-extra-dark">
            {companyName}
          </span>
          &apos;
        </p>
        <div className="flex w-full flex-col gap-3 px-[2px] h-[292px]">
          {response.names.map((match: CompanyMatch, i) => (
            <Result
              key={i}
              name={match.name}
              date={match.date}
              type={match.type}
              state={companyState}
              isSelected={match.name === selectedEntity?.name}
              onClick={() => handleSelect(match)}
            />
          ))}
        </div>
      </div>
      <ButtonSection
        handleConfirm={handleConfirm}
        handleContinueWithoutMatch={handleContinueWithoutMatch}
        isError={isError}
        helperText={helperText}
      />
    </div>
  );
}

function NoEntitiesFound({
  companyName,
  handleContinueWithoutMatch,
  helperText,
}: ButtonSectionProps & { companyName: string }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4">
        <p className="cursor-default leading-normal text-[16px] text-coal">
          No results for &apos;
          <span className="font-bold text-primary-extra-dark">
            {companyName}
          </span>
          &apos;
        </p>
        <Disclaimer>
          <Image src="/not_found.svg" alt="error" height="54" width="51" />
        </Disclaimer>
      </div>
      <ButtonSection
        handleContinueWithoutMatch={handleContinueWithoutMatch}
        helperText={helperText}
      />
    </div>
  );
}

function TooManyResults({
  companyName,
  handleContinueWithoutMatch,
  helperText,
}: ButtonSectionProps & { companyName: string }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4">
        <p className="cursor-default leading-normal text-[16px] text-coal">
          We found too many results for &apos;
          <span className="font-bold text-primary-extra-dark">
            {companyName}
          </span>
          &apos;
        </p>
        <Disclaimer>
          <Image src="/too_many.svg" alt="error" height="54" width="51" />
        </Disclaimer>
      </div>
      <ButtonSection
        handleContinueWithoutMatch={handleContinueWithoutMatch}
        helperText={helperText}
      />
    </div>
  );
}

export function EntitySearch() {
  const {
    companyName,
    errors,
    response,
    selectedState,
    searchedCompany,
    isLoading,
    selectedEntity,
    setIsFocused,
    setCompanyName,
    setSelectedEntity,
    handleStateChange,
    hasError,
    handleFormSubmit,
    handleFocus,
  } = useEntitySearch();

  const onSelect = (match: CompanyMatch) => {
    setSelectedEntity(match.name !== selectedEntity?.name ? match : undefined);
  };

  const helperTextResults =
    "Select your business to continue or adjust your search and try again";
  const helperTextNoResults =
    "Adjust your search and try again, or continue without a match";

  return (
    <div className="h-fit min-w-[700px] max-w-[800px] flex grow flex-col bg-white rounded-lg p-10 gap-6">
      {response === null && !isLoading && <TextSection />}
      <SearchBar
        handleFormSubmit={handleFormSubmit}
        hasError={hasError}
        setIsFocused={setIsFocused}
        handleFocus={handleFocus}
        setCompanyName={setCompanyName}
        companyName={companyName}
        errors={errors}
        selectedState={selectedState}
        handleStateChange={handleStateChange}
      />
      {isLoading ? (
        <Skeleton />
      ) : (
        <>
          {response?.status === "exact" && (
            <FoundCorporation
              companyState={selectedState}
              response={response as ExactResponse}
              handleConfirm={() => {}}
              handleContinueWithoutMatch={() => {}}
              setSelectedEntity={setSelectedEntity}
              helperText={helperTextResults}
            />
          )}
          {response?.status === "fuzzy" && (
            <Fuzzy
              companyName={searchedCompany}
              companyState={selectedState}
              response={response as FuzzyResponse}
              selectedEntity={selectedEntity}
              handleSelect={onSelect}
              handleConfirm={() => {}}
              handleContinueWithoutMatch={() => {}}
              helperText={helperTextResults}
            />
          )}
          {response?.status === "too_many" && (
            <TooManyResults
              companyName={searchedCompany}
              handleContinueWithoutMatch={() => {}}
              helperText={helperTextNoResults}
            />
          )}
          {response?.status === "not_found" && (
            <NoEntitiesFound
              companyName={searchedCompany}
              handleContinueWithoutMatch={() => {}}
              helperText={helperTextNoResults}
            />
          )}
        </>
      )}
    </div>
  );
}
