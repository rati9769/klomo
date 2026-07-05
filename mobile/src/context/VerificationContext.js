import React, { createContext, useContext, useState, useCallback } from 'react';

// Shared across the tab bar (badge dot on the Account icon) and the
// Account screen itself (the actual list) so the badge doesn't need its
// own separate fetch — AccountScreen already knows the count every time it
// loads, it just needs somewhere to publish it.
const VerificationContext = createContext({ pendingCount: 0, setPendingCount: () => {} });

export function VerificationProvider({ children }) {
  const [pendingCount, setPendingCountState] = useState(0);
  const setPendingCount = useCallback((n) => setPendingCountState(n), []);
  return (
    <VerificationContext.Provider value={{ pendingCount, setPendingCount }}>
      {children}
    </VerificationContext.Provider>
  );
}

export function useVerificationBadge() {
  return useContext(VerificationContext);
}
