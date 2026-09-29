export function responseError(status, serverMessage) {
  if (serverMessage) return serverMessage;
  if (status >= 500) return 'The app service is unavailable. The backend may be stopped or unable to connect to the database. Please try again when the service is running.';
  if (status === 401) return 'Your email or password is incorrect, or your session has expired. Please sign in again.';
  if (status === 403) return 'Your account does not have permission to perform this action.';
  if (status === 404) return 'The requested service could not be found. Please refresh the page.';
  if (status === 429) return 'Too many attempts. Please wait a moment before trying again.';
  return `The request could not be completed (HTTP ${status}). Please check your information and try again.`;
}
