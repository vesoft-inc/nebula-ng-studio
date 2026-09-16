export const SESSION_STORAGE_TOKEN_KEY = 'nebula-gui-token';
export const getToken = () => {
  return sessionStorage.getItem(SESSION_STORAGE_TOKEN_KEY) || '';
};

export const clearToken = () => {
  sessionStorage.removeItem(SESSION_STORAGE_TOKEN_KEY);
};

export const setToken = (token: string) => {
  sessionStorage.setItem(SESSION_STORAGE_TOKEN_KEY, token);
};

export const isLoggedIn = () => {
  return !!getToken();
};
