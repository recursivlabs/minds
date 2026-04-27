import * as React from 'react';
import { Redirect } from 'expo-router';

// The auth landing page (app/index.tsx) doubles as the welcome screen
// for unauthenticated users. Once they sign up, they land here and we
// redirect straight to the first real onboarding step.
export default function OnboardingRoot() {
  return <Redirect href="/onboarding/agent" />;
}
