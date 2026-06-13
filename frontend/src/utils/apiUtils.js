/**
 * API Utility Functions
 * Handles retries, error wrapping, and offline detection
 */

/**
 * Retry an async operation up to maxRetries times
 * @param {Function} fn - Async function to retry
 * @param {number} maxRetries - Max number of retries (default: 3)
 * @param {number} delayMs - Delay between retries in ms (default: 1000)
 */
export const retryAsync = async (fn, maxRetries = 3, delayMs = 1000) => {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry on client errors (4xx)
      if (error.status >= 400 && error.status < 500) {
        throw error;
      }
      
      // Only retry on network/server errors
      if (attempt < maxRetries) {
        console.warn(`Attempt ${attempt} failed, retrying in ${delayMs}ms...`, error.message);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  throw lastError;
};

/**
 * Check if user is online
 */
export const isOnline = () => {
  return typeof navigator !== 'undefined' && navigator.onLine;
};

/**
 * Wait for user to be online
 * @param {number} timeoutMs - Timeout in ms (default: 30000)
 */
export const waitForOnline = (timeoutMs = 30000) => {
  return new Promise((resolve, reject) => {
    if (isOnline()) {
      resolve();
      return;
    }
    
    const handler = () => {
      window.removeEventListener('online', handler);
      resolve();
    };
    
    window.addEventListener('online', handler);
    
    setTimeout(() => {
      window.removeEventListener('online', handler);
      reject(new Error('Timeout waiting for internet connection'));
    }, timeoutMs);
  });
};

/**
 * Wrap an error with more context
 */
export const wrapError = (error, context = '') => {
  if (typeof error === 'string') {
    return new Error(context ? `${context}: ${error}` : error);
  }
  if (error instanceof Error) {
    return error;
  }
  return new Error(context ? `${context}: ${JSON.stringify(error)}` : String(error));
};

/**
 * Get user-friendly error message
 */
export const getUserMessage = (error) => {
  if (!error) return 'An unknown error occurred';
  
  const msg = error.message || String(error);
  
  if (msg.includes('Network error')) {
    return 'Network error. Please check your internet connection.';
  }
  
  if (msg.includes('401') || msg.includes('Session expired')) {
    return 'Your session has expired. Please log in again.';
  }
  
  if (msg.includes('403') || msg.includes('Access denied')) {
    return 'You do not have permission to perform this action.';
  }
  
  if (msg.includes('404') || msg.includes('not found')) {
    return 'The resource was not found.';
  }
  
  if (msg.includes('500') || msg.includes('Internal Server')) {
    return 'Server error. Please try again later.';
  }
  
  return msg || 'An error occurred. Please try again.';
};
