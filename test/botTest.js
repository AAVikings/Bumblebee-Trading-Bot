var assert = require("chai").assert;
var simulatorExecutor = require("../Trading-Process/User.Bot")
var logger = require("./utils/logger")
var bot = require("../this.bot.config.json")
var globals = require("./utils/globals")
var assistantMock = require("./utils/assistantMock")
var auth = require("./utils/auth")
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
    })
    afterEach(() => {
        botInstance = undefined
    })

    describe("Initialize Function", function () {
        beforeEach(async () => {
            await auth.authenticate()
        })
        it("Check bot initialization", function (done) {
            botInstance.initialize(assistant, undefined, (result) => {
                assert.equal(result, global.DEFAULT_OK_RESPONSE)
                done()
            });
        });
    });

    describe("Start Function", function () {
        beforeEach(async () => {
            await auth.authenticate()
        })
        it("Indicator record older than 25 mins", function (done) {
            bot.processDatetime = new Date()
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
            bot.processDatetime = new Date()
            assistant.setFileNotFound(true)

            botInstance.start((result) => {
                assert.equal(result, global.DEFAULT_RETRY_RESPONSE)
                done()
            })
        })

        it("Stop Loss Exit", function (done) {
            bot.processDatetime = new Date()
            assistant.setAvailableBalance({
                assetA: 1,
                assetB: 0
            })
            var period = 1 * 60 * 60 * 1000 // 01 hs period
            var startTime = bot.processDatetime.valueOf() - period //Setting the indicator to current time
            var endTime = bot.processDatetime.valueOf()
            var simulatorEngineRecord = [startTime, endTime, "", 4000, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0.03, 0, 0, 0, 0, 0, 0, 0, 0]

            // Update Order Message received from the simulator
            var simulatorEngineMessage = {}
            simulatorEngineMessage.id = 136
            simulatorEngineMessage.from = MESSAGE_ENTITY.SimulationEngine
            simulatorEngineMessage.to = MESSAGE_ENTITY.SimulationExecutor
            simulatorEngineMessage.messageType = MESSAGE_TYPE.OrderUpdate
            simulatorEngineMessage.dateTime = startTime

            simulatorEngineMessage.order = {}
            simulatorEngineMessage.order.id = 1
            simulatorEngineMessage.order.creator = ORDER_CREATOR.SimulationEngine
            simulatorEngineMessage.order.dateTime = startTime
            simulatorEngineMessage.order.owner = ORDER_OWNER.User
            simulatorEngineMessage.order.exchange = global.EXCHANGE_NAME
            simulatorEngineMessage.order.market = global.MARKET.name
            simulatorEngineMessage.order.marginEnabled = ORDER_MARGIN_ENABLED.False
            simulatorEngineMessage.order.type = ORDER_TYPE.Limit
            simulatorEngineMessage.order.rate = 4000
            simulatorEngineMessage.order.stop = 3999.65000005075
            simulatorEngineMessage.order.takeProfit = 3800.5092009554182
            simulatorEngineMessage.order.direction = ORDER_DIRECTION.Sell
            simulatorEngineMessage.order.size = "All" // The SE is sending more than we have. Otherwise: assistant.getAvailableBalance().assetB
            simulatorEngineMessage.order.status = ORDER_STATUS.Signaled
            simulatorEngineMessage.order.sizeFilled = 0
            simulatorEngineMessage.order.exitOutcome = ""

            var orderMessageRecord = createRecordFromObject(simulatorEngineMessage)
            simulatorEngineRecord.push(orderMessageRecord)
            assistant.setFileRecords([simulatorEngineRecord])

            this.timeout(5000) // The axios call to the cockpit module is taking time to resolve.
            botInstance.start((result) => {
                assert.equal(result, global.DEFAULT_OK_RESPONSE)

                let simulatorExecutorMessage = {}
                simulatorExecutorMessage.id = assistant.getPositions()[0].id
                simulatorExecutorMessage.from = MESSAGE_ENTITY.SimulationExecutor
                simulatorExecutorMessage.to = MESSAGE_ENTITY.TradingAssistant
                simulatorExecutorMessage.messageType = MESSAGE_TYPE.Order
                simulatorExecutorMessage.dateTime = assistant.getPositions()[0].date

                simulatorExecutorMessage.order = {}
                simulatorExecutorMessage.order.id = assistant.getPositions()[0].id
                simulatorExecutorMessage.order.creator = ORDER_CREATOR.SimulationEngine
                simulatorExecutorMessage.order.dateTime = assistant.getPositions()[0].date
                simulatorExecutorMessage.order.owner = ORDER_OWNER.User
                simulatorExecutorMessage.order.exchange = global.EXCHANGE_NAME
                simulatorExecutorMessage.order.market = global.MARKET.name
                simulatorExecutorMessage.order.marginEnabled = ORDER_MARGIN_ENABLED.False
                simulatorExecutorMessage.order.type = ORDER_TYPE.Limit
                simulatorExecutorMessage.order.rate = assistant.getPositions()[0].rate
                simulatorExecutorMessage.order.stop = 3999.65000005075
                simulatorExecutorMessage.order.takeProfit = 3800.5092009554182
                simulatorExecutorMessage.order.direction = ORDER_DIRECTION.Buy
                simulatorExecutorMessage.order.size = assistant.getAvailableBalance().assetA
                simulatorExecutorMessage.order.status = ORDER_STATUS.Placed
                simulatorExecutorMessage.order.sizeFilled = "All"
                simulatorExecutorMessage.order.exitOutcome = ORDER_EXIT_OUTCOME.StopLoss

                var simulatorExecutorOutputMessage = createRecordFromObject(simulatorExecutorMessage)
                var ouput = assistant.getExtraData()
                assert.equal(JSON.stringify(ouput[0]), JSON.stringify(simulatorExecutorOutputMessage))
                done()
            })
        })

        it("Autopilot ON, Sell Signal", function (done) {
            bot.processDatetime = new Date()
            assistant.setAvailableBalance({
                assetA: 0,
                assetB: 1
            })
            var period = 1 * 60 * 60 * 1000 // 01 hs period
            var startTime = bot.processDatetime.valueOf() - period //Setting the indicator to current time
            var endTime = bot.processDatetime.valueOf()
            var simulatorEngineRecord = [startTime, endTime, "", 4000, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0.03, 0, 0, 0, 0, 0, 0, 0, 0]

            // Update Order received from the simulator
            var simulatorEngineMessage = {}
            simulatorEngineMessage.id = 136
            simulatorEngineMessage.from = MESSAGE_ENTITY.SimulationEngine
            simulatorEngineMessage.to = MESSAGE_ENTITY.SimulationExecutor
            simulatorEngineMessage.messageType = MESSAGE_TYPE.Order
            simulatorEngineMessage.dateTime = startTime

            simulatorEngineMessage.order = {}
            simulatorEngineMessage.order.id = 1
            simulatorEngineMessage.order.creator = ORDER_CREATOR.SimulationEngine
            simulatorEngineMessage.order.dateTime = startTime
            simulatorEngineMessage.order.owner = ORDER_OWNER.User
            simulatorEngineMessage.order.exchange = global.EXCHANGE_NAME
            simulatorEngineMessage.order.market = global.MARKET.name
            simulatorEngineMessage.order.marginEnabled = ORDER_MARGIN_ENABLED.False
            simulatorEngineMessage.order.type = ORDER_TYPE.Limit
            simulatorEngineMessage.order.rate = 4000
            simulatorEngineMessage.order.stop = 4100
            simulatorEngineMessage.order.takeProfit = 3900
            simulatorEngineMessage.order.direction = ORDER_DIRECTION.Sell
            simulatorEngineMessage.order.size = "All" // The SE is sending more than we have. Otherwise: assistant.getAvailableBalance().assetB
            simulatorEngineMessage.order.status = ORDER_STATUS.Signaled
            simulatorEngineMessage.order.sizeFilled = 0
            simulatorEngineMessage.order.exitOutcome = ""

            var orderMessageRecord = createRecordFromObject(simulatorEngineMessage)
            simulatorEngineRecord.push(orderMessageRecord)
            assistant.setFileRecords([simulatorEngineRecord])

            this.timeout(5000) // The axios call to the cockpit module is taking time to resolve.
            botInstance.start((result) => {
                assert.equal(result, global.DEFAULT_OK_RESPONSE)

                let simulatorExecutorMessage = {}
                simulatorExecutorMessage.id = assistant.getPositions()[0].id
                simulatorExecutorMessage.from = MESSAGE_ENTITY.SimulationExecutor
                simulatorExecutorMessage.to = MESSAGE_ENTITY.TradingAssistant
                simulatorExecutorMessage.messageType = MESSAGE_TYPE.Order
                simulatorExecutorMessage.dateTime = assistant.getPositions()[0].date

                simulatorExecutorMessage.order = {}
                simulatorExecutorMessage.order.id = assistant.getPositions()[0].id
                simulatorExecutorMessage.order.creator = ORDER_CREATOR.SimulationEngine
                simulatorExecutorMessage.order.dateTime = assistant.getPositions()[0].date
                simulatorExecutorMessage.order.owner = ORDER_OWNER.User
                simulatorExecutorMessage.order.exchange = global.EXCHANGE_NAME
                simulatorExecutorMessage.order.market = global.MARKET.name
                simulatorExecutorMessage.order.marginEnabled = ORDER_MARGIN_ENABLED.False
                simulatorExecutorMessage.order.type = ORDER_TYPE.Limit
                simulatorExecutorMessage.order.rate = assistant.getPositions()[0].rate
                simulatorExecutorMessage.order.stop = simulatorEngineMessage.order.stop
                simulatorExecutorMessage.order.takeProfit = simulatorEngineMessage.order.takeProfit
                simulatorExecutorMessage.order.direction = ORDER_DIRECTION.Sell
                simulatorExecutorMessage.order.size = assistant.getAvailableBalance().assetB
                simulatorExecutorMessage.order.status = ORDER_STATUS.Placed
                simulatorExecutorMessage.order.sizeFilled = 0
                simulatorExecutorMessage.order.exitOutcome = ''

                var simulatorExecutorOutputMessage = createRecordFromObject(simulatorExecutorMessage)
                var ouput = assistant.getExtraData()
                assert.equal(JSON.stringify(ouput[0]), JSON.stringify(simulatorExecutorOutputMessage))
                done()
            })
        })
    })

})
