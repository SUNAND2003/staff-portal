import { useEffect, useRef } from 'react';
import { useAttendanceStore } from '../store/store';
import { WORK_STATUS } from '../utils/constants';

const useTimer = () => {
  const status = useAttendanceStore((s) => s.status);
  const tickWork = useAttendanceStore((s) => s.tickWork);
  const tickBreak = useAttendanceStore((s) => s.tickBreak);
  const workIntervalRef = useRef(null);
  const breakIntervalRef = useRef(null);

  useEffect(() => {
    // Clear all intervals
    clearInterval(workIntervalRef.current);
    clearInterval(breakIntervalRef.current);

    if (status === WORK_STATUS.WORKING) {
      workIntervalRef.current = setInterval(() => {
        tickWork();
      }, 1000);
    } else if (status === WORK_STATUS.ON_BREAK) {
      breakIntervalRef.current = setInterval(() => {
        tickBreak();
      }, 1000);
    }

    return () => {
      clearInterval(workIntervalRef.current);
      clearInterval(breakIntervalRef.current);
    };
  }, [status, tickWork, tickBreak]);
};

export default useTimer;