/** Pause for `ms` milliseconds. One home for the small wait the api client and the server both need. */
export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
