export async function wait(ms: any) {
  new Promise((resolve) => setTimeout(resolve, ms));
}
