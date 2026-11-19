import React from 'react';
import {
  C01, C02, C03, C04, C05, C06, C07, C08, C09, C10,
  C11, C12, C13, C14, C15, C16, C24, C25, C26, C27,
  C28, C29, C30, C31, C32, C33, C34, C35, C41, C42
} from './OwnerWizardAndHome.jsx';
import {
  C17, C18, C19, C20, C21, C22, C23,
  C36, C37, C38, C39, C40, C43
} from './OwnerCentersAndProfile.jsx';

const RAW_OWNER_COMPONENTS = {
  C01, C02, C03, C04, C05, C06, C07, C08, C09, C10,
  C11, C12, C13, C14, C15, C16, C17, C18, C19, C20,
  C21, C22, C23, C24, C25, C26, C27, C28, C29, C30,
  C31, C32, C33, C34, C35, C36, C37, C38, C39, C40,
  C41, C42, C43,
};

function wrapOwnerScreen(code, Comp) {
  function WrappedOwnerScreen(props) {
    return (
      <div data-testid="screen" data-screen-code={code} className="min-h-full">
        <Comp {...props} />
      </div>
    );
  }
  WrappedOwnerScreen.displayName = `Owner_${code}`;
  return WrappedOwnerScreen;
}

export const OWNER_COMPONENTS = Object.fromEntries(
  Object.entries(RAW_OWNER_COMPONENTS).map(([code, Comp]) => [code, wrapOwnerScreen(code, Comp)])
);

export default OWNER_COMPONENTS;
