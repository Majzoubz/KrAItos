export const isStepCountingAvailable = async () => false;
export const requestPedometerPermission = async () => ({
  granted: false,
  reason: "Browsers don't expose device step data. Open the app on iPhone or Android to read live steps, or use Manual sync below.",
});
export const getStepsToday = async () => null;
export const subscribeSteps = () => () => {};
