import Cdp from "chrome-remote-interface";
import catchify from "catchify";
import sleep from "../utils/sleep";

async function openNewTab(maxTries = 100, currentTry = 1) {
  const [tabError, tab] = await catchify(
    Cdp.New({ host: "127.0.0.1", port: 9222 })
  );

  if (tabError) {
    if (
      (tabError.code === "ECONNREFUSED" || tabError.code === "ECONNRESET") &&
      currentTry < maxTries
    ) {
      await sleep(10);
      return openNewTab(maxTries, currentTry + 1);
    }

    throw tabError;
  }

  const [clientError, client] = await catchify(Cdp({ target: tab }));

  if (clientError) {
    if (
      (clientError.code === "ECONNREFUSED" ||
        clientError.code === "ECONNRESET") &&
      currentTry < maxTries
    ) {
      await sleep(10);
      return openNewTab(maxTries, currentTry + 1);
    }

    throw tabError;
  }

  return { tab, client };
}

export default async function captureScreenshotOfUrl(url) {
  const LOAD_TIMEOUT = process.env.PAGE_LOAD_TIMEOUT || 1000 * 60;

  let result;
  let loaded = false;

  const loading = async (startTime = Date.now()) => {
    if (!loaded && Date.now() - startTime < LOAD_TIMEOUT) {
      await sleep(100);
      await loading(startTime);
    }
  };
  const [newTabError, { tab, client } = {}] = await catchify(openNewTab());

  if (newTabError) {
    throw newTabError;
  }

  const { Network, Page, Runtime, Emulation } = client;

  Page.loadEventFired(() => {
    loaded = true;
  });

  try {
    await Promise.all([Network.enable(), Page.enable()]);
    await Emulation.setDeviceMetricsOverride({
      mobile: false,
      deviceScaleFactor: 0,
      scale: 1,
      fitWindow: false,
      width: 1280,
      height: 0
    });
    await Page.navigate({ url });
    await Page.loadEventFired();
    await loading();

    const { result: { value: { height } } } = await Runtime.evaluate({
      expression: `(
        () => ({ height: document.body.scrollHeight })
      )();
      `,
      returnByValue: true
    });

    await Emulation.setDeviceMetricsOverride({
      mobile: false,
      deviceScaleFactor: 0,
      scale: 1,
      fitWindow: false,
      width: 1280,
      height
    });

    const screenshot = await Page.captureScreenshot({ format: "png" });

    result = screenshot.data;
  } catch (error) {
    throw error;
  }

  await Cdp.Close({ id: tab.id });
  await client.close();

  return result;
}
