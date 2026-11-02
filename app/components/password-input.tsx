"use client";

import { useState } from "react";
import { Icon } from "@/app/components/icons";

type PasswordInputProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  maxLength?: number;
  required?: boolean;
  minLength?: number;
};

export default function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  maxLength = 128,
  required = true,
  minLength,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <span className="password-input">
      <input
        id={id}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={maxLength}
        minLength={minLength}
        required={required}
      />
      <button
        type="button"
        className="password-visibility"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        onClick={() => setVisible((current) => !current)}
      >
        <Icon name={visible ? "eyeOff" : "eye"} size={18} />
      </button>
    </span>
  );
}
