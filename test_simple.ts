import fs from "fs";
const log = (msg) => {
    console.log(msg);
    fs.appendFileSync("test_log.txt", msg + "\n");
};
log("STARTING SIMPLE TEST");
import crypto from "crypto";
log("CRYPTO: " + crypto.randomUUID());
log("FINISHED");
