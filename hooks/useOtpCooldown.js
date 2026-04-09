import { useEffect, useMemo, useRef, useState } from 'react';

export function useOtpCooldown({ cooldownSeconds = 60 } = {}) {
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const intervalRef = useRef(null);

  const startCooldown = () => {
    setRemainingSeconds(cooldownSeconds);
  };

  useEffect(() => {
    if (remainingSeconds <= 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    if (!intervalRef.current) {
      intervalRef.current = setInterval(() => {
        setRemainingSeconds((prev) => Math.max(0, prev - 1));
      }, 1000);
    }
  }, [remainingSeconds]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const isCoolingDown = remainingSeconds > 0;
  const labelSuffix = useMemo(() => (isCoolingDown ? ` (${remainingSeconds}s)` : ''), [isCoolingDown, remainingSeconds]);

  return {
    remainingSeconds,
    isCoolingDown,
    labelSuffix,
    startCooldown,
    setRemainingSeconds,
  };
}

