/**
 * Runs a Server Action from the browser and turns a call that fails altogether (no network, the server
 * not answering, a deployment in the middle of changing) into the same `{ ok: false, error }` that an
 * action reports for a refused request. Without it the call throws, and whatever was waiting for it (a
 * button saying "发布中…", an optimistic heart) never gets its turn to go back to how it was.
 */
export const NETWORK_ERROR = "网络出错了，请检查连接后再试。";

export async function attempt<R>(run: () => Promise<R>): Promise<R | { ok: false; error: string }> {
  try {
    return await run();
  } catch (error) {
    console.error("action did not complete:", error);
    return { ok: false, error: NETWORK_ERROR };
  }
}
