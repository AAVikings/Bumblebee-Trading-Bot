var assert = require("chai").assert;
var simulatorExecutor = require("../Trading-Process/User.Bot")
var logger = require("./utils/logger")
var bot = require("../this.bot.config.json")
var globals = require("./utils/globals")
var assistantMock = require("./utils/assistantMock")
var auth = require("./utils/auth")
var { buildSimulatorEngineMessage } = require("./utils/buildSimulatorEngineMessage")
var { buildSimulatorExecutorMessage } = require("./utils/buildSimulatorExecutorMessage")
require('dotenv').config()
const {
    MESSAGE_ENTITY, MESSAGE_TYPE, ORDER_CREATOR, ORDER_TYPE, ORDER_OWNER,
    ORDER_DIRECTION, ORDER_STATUS, ORDER_EXIT_OUTCOME, ORDER_MARGIN_ENABLED,
    getRecord, createRecordFromObject
} = require("@superalgos/mqservice")

describe("SimulatorExecutor ", function () {

    var botInstance
    bot.processDatetime = new Date()
    bot.timePeriodFileStorage = "01-hs"
    bot.dataSet = "Multi-Period-Market"
    bot.botCache = new Map()
    globals.setGlobals()
    var assistant = assistantMock.newAssistantMock()

    beforeEach(async () => {
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
        it("Indicator record older than 25 mins", function (done) {
            var simulatorEngineRecord = [1552864500000, 1552867199999, "", 3986.3999999, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0.03125, 0, 0, 0, 0, 0, 0, 0, 0]
            var orderMessageRecord = [1, "EN", "EX", "HBT", 1553941714826, [0, "", 0, "", "", "", 0, "", 0, 0, 0, "", "", "", 0, ""]]
            simulatorEngineRecord.push(orderMessageRecord)
            assistant.setFileRecords([simulatorEngineRecord])

            this.timeout(5000) // The axios call to the cockpit module is taking time to resolve.
            botInstance.start((result) => {
                assert.equal(result, global.DEFAULT_RETRY_RESPONSE)
                done()
            })
        })
        it("Indicator file not found, retry", function (done) {
            assistant.setFileNotFound(true)

            botInstance.start((result) => {
                assert.equal(result, global.DEFAULT_RETRY_RESPONSE)
                done()
            })
        })

        it("Trade Exit: Stop Loss", function (done) {
            // Set the market context and balances
            assistant.setAvailableBalance({
                assetA: 4000,
                assetB: 0
            })
            assistant.setMarketRate(4100)

            // Set the dependencies parameters
            var period = 1 * 60 * 60 * 1000 // 01 hs period
            var startTime = bot.processDatetime.valueOf() - period //Setting the indicator to current time
            var endTime = bot.processDatetime.valueOf()
            var simulatorEngineRecord = [startTime, endTime, "", 4000, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0.03, 0, 0, 0, 0, 0, 0, 0, 0]

            var simulatorEngineMessage = buildSimulatorEngineMessage(bot.processDatetime.valueOf())
            var orderMessageRecord = createRecordFromObject(simulatorEngineMessage)
            simulatorEngineRecord.push(orderMessageRecord)
            assistant.setFileRecords([simulatorEngineRecord])

            // Execute the bot
            this.timeout(5000) // The axios call to the cockpit module is taking time to resolve.
            botInstance.start((result) => {
                assert.equal(result, global.DEFAULT_OK_RESPONSE)

                let simulatorExecutorMessage = buildSimulatorExecutorMessage(assistant, bot.processDatetime.valueOf())
                var simulatorExecutorOutputMessage = createRecordFromObject(simulatorExecutorMessage)
                var ouput = assistant.getExtraData()
                assert.equal(JSON.stringify(ouput[0]), JSON.stringify(simulatorExecutorOutputMessage))
                done()
            })
        })

        it("Trade Exit: Take Profit", function (done) {
            // Set the market context and balances
            assistant.setAvailableBalance({
                assetA: 4000,
                assetB: 0
            })

            assistant.setMarketRate(3900)

            // Set the dependencies parameters
            var period = 1 * 60 * 60 * 1000 // 01 hs period
            var startTime = bot.processDatetime.valueOf() - period //Setting the indicator to current time
            var endTime = bot.processDatetime.valueOf()
            var simulatorEngineRecord = [startTime, endTime, "", 4000, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0.03, 0, 0, 0, 0, 0, 0, 0, 0]

            var simulatorEngineMessage = buildSimulatorEngineMessage(bot.processDatetime.valueOf())
            var orderMessageRecord = createRecordFromObject(simulatorEngineMessage)
            simulatorEngineRecord.push(orderMessageRecord)
            assistant.setFileRecords([simulatorEngineRecord])

            // Execute the bot
            this.timeout(5000) // The axios call to the cockpit module is taking time to resolve.
            botInstance.start((result) => {
                assert.equal(result, global.DEFAULT_OK_RESPONSE)

                let simulatorExecutorMessage = buildSimulatorExecutorMessage(assistant, bot.processDatetime.valueOf())
                simulatorExecutorMessage.order.exitOutcome = ORDER_EXIT_OUTCOME.TakeProfit
                var simulatorExecutorOutputMessage = createRecordFromObject(simulatorExecutorMessage)
                var ouput = assistant.getExtraData()
                assert.equal(JSON.stringify(ouput[0]), JSON.stringify(simulatorExecutorOutputMessage))
                done()
            })
        })

        it("Autopilot ON, Sell Signal", function (done) {
            // Set the market context and balances
            assistant.setAvailableBalance({
                assetA: 0,
                assetB: 1
            })

            // Set the dependencies parameters
            var period = 1 * 60 * 60 * 1000 // 01 hs period
            var startTime = bot.processDatetime.valueOf() - period //Setting the indicator to current time
            var endTime = bot.processDatetime.valueOf()
            var simulatorEngineRecord = [startTime, endTime, "", 4000, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0.03, 0, 0, 0, 0, 0, 0, 0, 0]

            var simulatorEngineMessage = buildSimulatorEngineMessage(bot.processDatetime.valueOf())
            simulatorEngineMessage.messageType = MESSAGE_TYPE.Order
            simulatorEngineMessage.order.rate = 4000
            simulatorEngineMessage.order.stop = 4100
            simulatorEngineMessage.order.takeProfit = 3900

            var orderMessageRecord = createRecordFromObject(simulatorEngineMessage)
            simulatorEngineRecord.push(orderMessageRecord)
            assistant.setFileRecords([simulatorEngineRecord])

            // Execute the bot
            this.timeout(5000) // The axios call to the cockpit module is taking time to resolve.
            botInstance.setAutopilot(true)
            botInstance.start((result) => {
                assert.equal(result, global.DEFAULT_OK_RESPONSE)

                let simulatorExecutorMessage = buildSimulatorExecutorMessage(assistant, bot.processDatetime.valueOf())
                simulatorExecutorMessage.order.stop = simulatorEngineMessage.order.stop
                simulatorExecutorMessage.order.takeProfit = simulatorEngineMessage.order.takeProfit
                simulatorExecutorMessage.order.direction = ORDER_DIRECTION.Sell
                simulatorExecutorMessage.order.size = assistant.getAvailableBalance().assetB
                simulatorExecutorMessage.order.exitOutcome = ''

                var simulatorExecutorOutputMessage = createRecordFromObject(simulatorExecutorMessage)
                var ouput = assistant.getExtraData()
                assert.equal(JSON.stringify(ouput[0]), JSON.stringify(simulatorExecutorOutputMessage))
                done()
            })
        })
        it("Autopilot OFF, Creating new Signal", function (done) {
            // Set the market context and balances
            assistant.setAvailableBalance({
                assetA: 0,
                assetB: 1
            })
            assistant.setMarketRate(4000)

            // Set the dependencies parameters
            var period = 1 * 60 * 60 * 1000 // 01 hs period
            var startTime = bot.processDatetime.valueOf() - period //Setting the indicator to current time
            var endTime = bot.processDatetime.valueOf()
            var simulatorEngineRecord = [startTime, endTime, "", 4000, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0.03, 0, 0, 0, 0, 0, 0, 0, 0]

            var simulatorEngineMessage = buildSimulatorEngineMessage(bot.processDatetime.valueOf())
            simulatorEngineMessage.messageType = MESSAGE_TYPE.Order

            var orderMessageRecord = createRecordFromObject(simulatorEngineMessage)
            simulatorEngineRecord.push(orderMessageRecord)
            assistant.setFileRecords([simulatorEngineRecord])

            // Execute the bot
            this.timeout(5000) // The axios call to the cockpit module is taking time to resolve.
            botInstance.start((result) => {
                assert.equal(result, global.DEFAULT_OK_RESPONSE)

                let simulatorExecutorMessage = buildSimulatorExecutorMessage(assistant, bot.processDatetime.valueOf())
                simulatorExecutorMessage.to = MESSAGE_ENTITY.TradingCokpit
                simulatorExecutorMessage.order.stop = simulatorEngineMessage.order.stop
                simulatorExecutorMessage.order.takeProfit = simulatorEngineMessage.order.takeProfit
                simulatorExecutorMessage.order.rate = assistant.getMarketRate()
                simulatorExecutorMessage.order.direction = ORDER_DIRECTION.Sell
                simulatorExecutorMessage.order.size = assistant.getAvailableBalance().assetB
                simulatorExecutorMessage.order.status = ORDER_STATUS.Signaled
                simulatorExecutorMessage.order.exitOutcome = ''

                var simulatorExecutorOutputMessage = createRecordFromObject(simulatorExecutorMessage)
                var ouput = assistant.getExtraData()
                assert.equal(JSON.stringify(ouput[0]), JSON.stringify(simulatorExecutorOutputMessage))
                done()
            })
        })
    })

})
