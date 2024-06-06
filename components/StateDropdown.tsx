"use client";

import { Combobox } from "@headlessui/react";
import { useCallback, useState } from "react";

export interface DropdownProps {
  name: string;
  value?: any;
  placeholder?: any;
  words?: number;
  options: any;
  changed: any;
  required?: boolean;
  hasError: boolean;
}

type Option = {
  label: string;
  value: string;
};

export function StateDropdown({
  name,
  value,
  placeholder,
  options,
  changed,
  hasError,
}: DropdownProps) {
  const [val, setVal] = useState(value);

  const currentOption = useCallback(() => {
    const option = val && options?.find((o: Option) => o.value === val);
    return option || "";
  }, [options, val]);

  const [visible, setVisible] = useState<Option[]>([]);
  const [filter, setFilter] = useState("");

  const onInputChange = (e: any) => {
    const newValue = e.target.value;
    setFilter(newValue);
    if (newValue.length) {
      const matches = options.filter((option: Option) =>
        option.label.match(new RegExp(newValue, "i"))
      );
      setVisible(matches);
    } else {
      setVisible(options);
    }
  };

  const onChange = (option: Option) => {
    const v = option?.value || null;
    setVal(v);
    changed({ [name]: v });
  };

  function Option({ label }: { label: string }) {
    if (!filter.length) return label;

    const words = [];
    let pos = 0;

    const re = RegExp(filter.replace(/[\W]+/g, ""), "dgi");
    const next = () => {
      const result = re.exec(label);
      return result?.indices?.length && result.indices[0];
    };

    let idxs = next();
    if (!idxs) return label;

    while (pos < label.length) {
      if (idxs && pos === idxs[0]) {
        const word = label.substring(idxs[0], idxs[1]);
        pos = idxs[1];
        idxs = next();
        words.push(
          <span key={pos} className="font-bold text-primary-extra-dark">
            {word}
          </span>
        );
      } else {
        const len = idxs ? idxs[0] : label.length;
        const word = label.substring(pos, len);
        pos = len;
        words.push(word);
      }
    }
    return <div>{words}</div>;
  }

  return (
    <Combobox onChange={onChange} defaultValue={currentOption()}>
      <div className="relative flex w-full flex-col">
        <div className="w-full rounded-1 hover:border-gray-dark focus:border-none active:border-none">
          <Combobox.Button className="flex h-[54px] w-full items-center justify-around gap-4 rounded-full bg-white px-4">
            <Combobox.Input
              autoComplete="off"
              name={name}
              className={`bg-transparent placeholder-gray-placeholder flex h-full w-full select-none items-center justify-between overflow-clip whitespace-nowrap text-[17px] leading-[48px] outline-none placeholder:text-[#666] ${
                hasError && "placeholder:text-[#CF3F3F]"
              }`}
              displayValue={(option: Option) => option?.label}
              placeholder={placeholder}
              onChange={onInputChange}
              onFocus={() => setVisible(options)}
            />
            <svg
              width="14"
              height="8"
              viewBox="0 0 14 8"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="hidden ui-open:block"
            >
              <path
                d="M6.89876 0.256924C6.74321 0.280257 6.59933 0.350253 6.48657 0.459136L0.264659 6.43217C0.107168 6.56536 0.0119005 6.75688 0.00119882 6.962C-0.010466 7.16713 0.0634179 7.36836 0.204384 7.51712C0.346321 7.66683 0.543677 7.75044 0.748801 7.74947C0.954903 7.74947 1.15031 7.66391 1.29128 7.51323L7 2.03023L9.85436 4.77173L12.7087 7.51323C12.8497 7.66391 13.0451 7.74947 13.2512 7.74947C13.4563 7.75044 13.6537 7.66683 13.7956 7.51712C13.9366 7.36837 14.0105 7.16715 13.9988 6.962C13.9881 6.75687 13.8928 6.56534 13.7353 6.43217L7.51343 0.460132C7.35011 0.30264 7.12334 0.227759 6.89876 0.256924Z"
                fill="#828282"
              />
            </svg>
            <svg
              width="14"
              height="8"
              viewBox="0 0 14 8"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="block ui-open:hidden"
            >
              <path
                d="M7.10124 7.7432C7.25679 7.71986 7.40067 7.64987 7.51343 7.54099L13.7353 1.56796C13.8928 1.43477 13.9881 1.24325 13.9988 1.03812C14.0105 0.832994 13.9366 0.631758 13.7956 0.483005C13.6537 0.33329 13.4563 0.249683 13.2512 0.250656C13.0451 0.250656 12.8497 0.336207 12.7087 0.486894L7 5.96989L4.14564 3.22839L1.29128 0.486893C1.15031 0.336206 0.954896 0.250655 0.748801 0.250655C0.543671 0.249682 0.346319 0.333289 0.204384 0.483003C0.0634181 0.631747 -0.010466 0.832973 0.00119936 1.03812C0.0118938 1.24325 0.107166 1.43478 0.26466 1.56795L6.48657 7.53999C6.64989 7.69748 6.87666 7.77236 7.10124 7.7432Z"
                fill="#828282"
              />
            </svg>
          </Combobox.Button>
        </div>
        <div className="relative">
          <Combobox.Options className="absolute z-20 flex max-h-[260px] min-h-[48px] w-full flex-col gap-2 overflow-y-scroll rounded-b-lg border-y border-white bg-white py-4 shadow-xl outline-none">
            {visible.map((option: Option) => (
              <Combobox.Option
                key={option.value}
                value={option}
                className="mx-2 flex cursor-pointer items-center gap-2 px-2 py-2 hover:bg-[#eeedf8] active:bg-primary-extra-light ui-active:bg-primary-extra-light"
              >
                <svg
                  width="12"
                  height="10"
                  viewBox="0 0 12 10"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="opacity-0 ui-selected:opacity-100"
                >
                  <path
                    d="M11.6962 0.756627C12.0801 1.11839 12.1033 1.72848 11.7479 2.11932L5.31726 9.19074C5.13796 9.38791 4.88597 9.5 4.62201 9.5C4.35805 9.5 4.10607 9.38791 3.92676 9.19074L0.252125 5.14993C-0.103289 4.7591 -0.080137 4.149 0.303838 3.78724C0.687812 3.42548 1.28721 3.44904 1.64262 3.83987L4.62201 7.11616L10.3574 0.809263C10.7128 0.418432 11.3122 0.394866 11.6962 0.756627Z"
                    fill="#BBB7E2"
                  />
                </svg>
                <Option {...option} />
              </Combobox.Option>
            ))}
          </Combobox.Options>
        </div>
      </div>
    </Combobox>
  );
}
