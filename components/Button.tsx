import { ReactNode } from "react";

export type ButtonType =
  | "primary"
  | "secondary"
  | "secondary-inverse"
  | "tertiary"
  | "social";
export type ButtonSize = "small" | "medium" | "large" | "social";
export type IconPlacement = "left" | "right";

interface ButtonProps {
  label: string | ReactNode;
  type?: ButtonType;
  size?: ButtonSize;
  className?: string;
  onClick?: () => void;
  id?: string;
  disabled?: boolean;
  loading?: boolean;
  children?: ReactNode;
  iconPlacement?: IconPlacement;
}

const baseClassName =
  "whitespace-nowrap rounded-full cursor-default hover:cursor-pointer disabled:cursor-default flex items-center justify-center";

const buttonStyles: Record<ButtonType, string> = {
  primary:
    "font-semibold  text-coal bg-primary hover:bg-primary-light active:bg-primary-dark disabled:bg-gray-extra-light disabled:text-gray",
  secondary:
    "font-semibold  text-gray-dark ring-1 ring-gray-dark hover:text-coal hover:ring-2 hover:ring-coal active:bg-gray-extra-light disabled:text-gray disabled:ring-gray-light",
  "secondary-inverse":
    "font-semibold  text-white ring-1 ring-white hover:text-gray-extra-light active:text-white hover:ring-2 hover:ring-gray-extra-light active:bg-white active:bg-opacity-10 disabled:text-gray-light disabled:ring-gray-light",
  tertiary:
    "font-semibold  bg-tertiary text-coal hover:bg-tertiary-light active:bg-tertiary-dark disabled:bg-gray-light disabled:text-gray",
  social:
    "font-normal text-coal border border-gray-medium hover:border-gray-dark active:bg-gray-extra-light disabled:text-gray disabled:border-gray-light",
};

const buttonSizes: Record<ButtonSize, string> = {
  large: "px-[78px] h-[58px] min-h-[58px] text-[21px]",
  medium: "px-[48px] h-[48px] min-h-[48px] text-[20px]",
  small: "py-[8px] px-[32px] h-[44px] min-h-[44px] text-[18px]",
  social: "h-[40px] min-h-[40px] text-[16px]",
};

export default function Button({
  label,
  type = "primary",
  size = "medium",
  className = "",
  onClick,
  id,
  disabled = false,
  loading = false,
  children,
  iconPlacement = "right",
}: ButtonProps) {
  const fullClassName = `${baseClassName} ${buttonStyles[type]} ${
    buttonSizes[size]
  } ${children ? "gap-3" : ""} ${
    iconPlacement === "right" ? "flex-row" : "flex-row-reverse"
  } ${className}`;
  return (
    <button
      id={id}
      className={fullClassName}
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading && <div className="thin-spinner h-[22px] w-[22px]" />}
      <div>{label}</div>
      {children}
    </button>
  );
}
