import Toast from 'react-native-toast-message';

export const useToast = () => {
  const showToast = (message, type = 'info') => {
    const toastConfig = {
      type: type === 'error' ? 'error' : type === 'success' ? 'success' : 'info',
      text1: type === 'error' ? 'Error' : type === 'success' ? 'Success' : 'Info',
      text2: message,
      visibilityTime: 4000,
      autoHide: true,
      topOffset: 60,
    };

    Toast.show(toastConfig);
  };

  return showToast;
};