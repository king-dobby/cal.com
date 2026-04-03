"use client";

import type { AriaRole, ComponentType } from "react";
import React, { Fragment } from "react";

type LicenseRequiredProps = {
  as?: keyof JSX.IntrinsicElements | "";
  className?: string;
  role?: AriaRole | undefined;
  children: React.ReactNode;
};

/**
 * Self-hosted: license check bypassed — always render children.
 */
const LicenseRequired = ({ children, as = "", ...rest }: LicenseRequiredProps) => {
  const Component = as || Fragment;
  return <Component {...rest}>{children}</Component>;
};

export const withLicenseRequired =
  <T extends JSX.IntrinsicAttributes>(Component: ComponentType<T>) =>
  (hocProps: T) => (
    <div>
      <LicenseRequired>
        <Component {...hocProps} />
      </LicenseRequired>
    </div>
  );

export default LicenseRequired;

