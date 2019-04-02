exports.setGlobals = function () {

    /* Callbacks default responses. */

    global.DEFAULT_OK_RESPONSE = {
        result: "Ok",
        message: "Operation Succeeded"
    };

    global.DEFAULT_FAIL_RESPONSE = {
        result: "Fail",
        message: "Operation Failed"
    };

    global.DEFAULT_RETRY_RESPONSE = {
        result: "Retry",
        message: "Retry Later"
    };

    global.CUSTOM_OK_RESPONSE = {
        result: "Ok, but check Message",
        message: "Custom Message"
    };

    global.CUSTOM_FAIL_RESPONSE = {
        result: "Fail Because",
        message: "Custom Message"
    };

    global.EXCHANGE_NAME = process.env.EXCHANGE_NAME

    global.MARKET = {
        assetA: process.env.MARKET_ASSET_A,
        assetB: process.env.MARKET_ASSET_B,
        name: process.env.MARKET_ASSET_A + "_" + process.env.MARKET_ASSET_B
    }

    global.MARKET_PAIRS = {
        USDT_BTC: "USDT_BTC",
        BTC_USDT: "BTC_USDT"
    }
}
