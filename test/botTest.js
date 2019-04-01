var assert = require("chai").assert;
var simulatorExecutor = require("../Trading-Process/User.Bot")
var logger = require("./utils/logger")
var bot = require("../this.bot.config.json")
var globals = require("./utils/globals")
var assistantMock = require("./utils/assistantMock")
var auth = require("./utils/auth")
require('dotenv').config()

describe("SimulatorExecutor ", function () {

    var botInstance
    bot.processDatetime = new Date()
    bot.timePeriodFileStorage = "01-hs"
    bot.dataSet = "Multi-Period-Market"
    bot.botCache = new Map()
    globals.setGlobals()
    let assistant = assistantMock.newAssistantMock()

    beforeEach(async() => {
        botInstance = simulatorExecutor.newUserBot(bot, logger)
        botInstance.initialize(assistant, undefined, (result) => { })
        await auth.authenticate()
    })
    afterEach(() => {
        botInstance = undefined
    })

    describe("Initialize Function", function () {
        it("Check bot initialization", function (done) {
            botInstance.initialize(assistant, undefined, (result) => {
                assert.equal(result, global.DEFAULT_OK_RESPONSE)
                done()
            });
        });
    });

    describe("Start Function", function () {
        beforeEach(async() => {
            await auth.authenticate()
        })
        it("Indicator record older than 25 mins", function (done) {
            bot.processDatetime = new Date()
            assistant.setFileRecords([[1552864500000,1552867199999,"",3986.3999999,1,1,0,0,0,0,0,0,0,0,0,1,0.03125,0,0,0,0,0,0,0,0,[1,"EN","EX","HBT",1553941714826,[0,"",0,"","","",0,"",0,0,0,"","","",0,""]]]])

            this.timeout(5000) // The axios call to the cockpit module is taking time to resolve.
            botInstance.start((result) => {
                assert.equal(result, global.DEFAULT_OK_RESPONSE)
                done()
            });
        });
        it("Indicator file not found, retry.", function (done) {
            bot.processDatetime = new Date()
            assistant.setFileNotFound(true)

            botInstance.start((result) => {
                assert.equal(result, global.DEFAULT_RETRY_RESPONSE)
                done()
            });
        });
    });

});
