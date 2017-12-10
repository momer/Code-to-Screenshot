import catchify from "catchify";
import validator from "validator";
import screenshot from "../chrome/screenshot";

export default async function handler(event, context, callback) {
  if (!event.body) {
    return callback(new Error("Request is not valid, request body missing"));
  }

  let input;

  try {
    if (event.isBase64Encoded) {
      const bodyBuffer = new Buffer(event.body, "base64");
      const decodedBody = bodyBuffer.toString("ascii");

      input = JSON.parse(decodedBody);
    } else {
      input = JSON.parse(event.body);
    }
  } catch (bodyParseError) {
    return callback(bodyParseError);
  }

  const { url = "" } = input;

  if (!url) {
    return callback(new Error("Request is not valid, url is missing"));
  }

  if (!validator.isURL(url)) {
    return callback(new Error("Request is not valid, url is not valid"));
  }

  const [screenshotError, screenshotData] = await catchify(screenshot(url));

  if (screenshotError) {
    console.error("Error capturing screenshot for", url, screenshotError);
    return callback(screenshotError);
  }

  return callback(null, {
    statusCode: 200,
    body: screenshotData,
    isBase64Encoded: true,
    headers: {
      "Content-Type": "image/png"
    }
  });
}
