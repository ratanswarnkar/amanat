import { Redirect } from 'expo-router';
import { useContext } from 'react';
import AppLoader from '../components/ui/AppLoader';
import { AuthContext } from '../context/AuthContext';
import { hasMultipleActiveRoles, getRouteForSessionRole } from '../src/utils/roleRouting';

export default function Index() {
  const { token, user, roles, userRole, isAuthLoading } = useContext(AuthContext);

  if (isAuthLoading) {
    return <AppLoader text="Loading Amanat..." fullScreen />;
  }

  if (token && user?.hasSecurityQuestions === false) {
    return <Redirect href="/security-questions/setup" />;
  }

  if (token && hasMultipleActiveRoles(roles) && !userRole) {
    return <Redirect href="/role-select" />;
  }

  return <Redirect href={token ? getRouteForSessionRole(userRole) : '/mobile'} />;
}
