var assert = require("chai").assert
var simulatorExecutor = require("../Trading-Process/User.Bot")
var logger = require("./utils/logger")
var bot = require("../this.bot.config.json")
var globals = require("./utils/globals")
var assistantMock = require("./utils/assistantMock")
var { buildSimulatorEngineMessage } = require("./utils/buildSimulatorEngineMessage")
var { buildSimulatorExecutorMessage } = require("./utils/buildSimulatorExecutorMessage")
var { updateToManualAuthorized } = require("./utils/updateToManualAuthorized")
require('dotenv').config()
const { orderMessage } = require("@superalgos/mqservice")
const {
    MESSAGE_ENTITY, MESSAGE_TYPE, ORDER_CREATOR, ORDER_TYPE, ORDER_OWNER,
    ORDER_DIRECTION, ORDER_STATUS, ORDER_EXIT_OUTCOME, ORDER_MARGIN_ENABLED,
    createMessage, getMessage, getExpandedMessage, createMessageFromObject
} = orderMessage.newOrderMessage()

describe("SimulatorExecutor ", function () {

    var botInstance
    bot.processDatetime = new Date()
    bot.timePeriodFileStorage = "01-hs"
    bot.dataSet = "Multi-Period-Market"
    bot.botCache = new Map()
    globals.setGlobals()
    var assistant = assistantMock.newAssistantMock()

    describe("Initialize Function", function () {
        beforeEach(async () => {
            assistant = assistantMock.newAssistantMock()
            botInstance = simulatorExecutor.newUserBot(bot, logger)
            botInstance.initialize(assistant, undefined, (result) => { })
        })
        afterEach(() => {
            botInstance = undefined
            assistant = undefined
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
            assistant = assistantMock.newAssistantMock()
            botInstance = simulatorExecutor.newUserBot(bot, logger)
            botInstance.initialize(assistant, undefined, (result) => { })
        })
        afterEach(() => {
            botInstance = undefined
            assistant = undefined
        })
        it("Indicator older than 10 mins. No previous order.", function (done) {
            this.timeout(95000) // The axios call to the cockpit module is taking time to resolve.
            var simulatorEngineRecord = [1552864500000, 1552867199999, "", 3986.3999999, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0.03125, 0, 0, 0, 0, 0, 0, 0, 0]
            var orderMessageMessage = [1, "EN", "EX", "HBT", 1553941714826, [0, "", 0, "", "", "", 0, "", 0, 0, 0, "", "", "", 0, ""]]
            simulatorEngineRecord.push(orderMessageMessage)
            assistant.setFileMessages([simulatorEngineRecord])

            botInstance.start((result) => {
                assert.isOk('everything', 'everything is ok')
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
            var period = 5 * 60 * 1000 // 5 minutes delay
            var startTime = bot.processDatetime.valueOf() - period // Setting the indicator to current time
            var endTime = bot.processDatetime.valueOf()
            var simulatorEngineRecord = [startTime, endTime, "", 4000, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0.03, 0, 0, 0, 0, 0, 0, 0, 0]

            var simulatorEngineMessage = buildSimulatorEngineMessage(bot.processDatetime.valueOf())
            var orderMessageMessage = createMessageFromObject(simulatorEngineMessage)
            simulatorEngineRecord.push(orderMessageMessage)
            assistant.setFileMessages([simulatorEngineRecord])

            // Execute the bot
            this.timeout(5000) // The axios call to the cockpit module is taking time to resolve.
            botInstance.start((result) => {
                assert.equal(result, global.DEFAULT_OK_RESPONSE)

                let simulatorExecutorMessage = buildSimulatorExecutorMessage(assistant, bot.processDatetime.valueOf())
                var simulatorExecutorOutputMessage = createMessageFromObject(simulatorExecutorMessage)
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
            var period = 5 * 60 * 1000 // 5 minutes delay
            var startTime = bot.processDatetime.valueOf() - period // Setting the indicator to current time
            var endTime = bot.processDatetime.valueOf()
            var simulatorEngineRecord = [startTime, endTime, "", 4000, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0.03, 0, 0, 0, 0, 0, 0, 0, 0]

            var simulatorEngineMessage = buildSimulatorEngineMessage(bot.processDatetime.valueOf())
            var orderMessageMessage = createMessageFromObject(simulatorEngineMessage)
            simulatorEngineRecord.push(orderMessageMessage)
            assistant.setFileMessages([simulatorEngineRecord])

            // Execute the bot
            this.timeout(5000) // The axios call to the cockpit module is taking time to resolve.
            botInstance.start((result) => {
                assert.equal(result, global.DEFAULT_OK_RESPONSE)

                let simulatorExecutorMessage = buildSimulatorExecutorMessage(assistant, bot.processDatetime.valueOf())
                simulatorExecutorMessage.order.exitOutcome = ORDER_EXIT_OUTCOME.TakeProfit
                var simulatorExecutorOutputMessage = createMessageFromObject(simulatorExecutorMessage)
                var ouput = assistant.getExtraData()
                assert.equal(JSON.stringify(ouput[0]), JSON.stringify(simulatorExecutorOutputMessage))
                done()
            })
        })

        it("Autopilot ON, Sell.", function (done) {
            // Set the market context and balances
            assistant.setAvailableBalance({
                assetA: 0,
                assetB: 1
            })

            // Set the dependencies parameters
            var period = 5 * 60 * 1000 // 5 minutes delay
            var startTime = bot.processDatetime.valueOf() - period // Setting the indicator to current time
            var endTime = bot.processDatetime.valueOf()
            var simulatorEngineRecord = [startTime, endTime, "", 4000, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0.03, 0, 0, 0, 0, 0, 0, 0, 0]

            var simulatorEngineMessage = buildSimulatorEngineMessage(bot.processDatetime.valueOf())
            simulatorEngineMessage.messageType = MESSAGE_TYPE.Order
            simulatorEngineMessage.order.rate = 4000
            simulatorEngineMessage.order.stop = 4100
            simulatorEngineMessage.order.takeProfit = 3900

            var orderMessageMessage = createMessageFromObject(simulatorEngineMessage)
            simulatorEngineRecord.push(orderMessageMessage)
            assistant.setFileMessages([simulatorEngineRecord])

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

                var simulatorExecutorOutputMessage = createMessageFromObject(simulatorExecutorMessage)
                var ouput = assistant.getExtraData()
                assert.equal(JSON.stringify(ouput[0]), JSON.stringify(simulatorExecutorOutputMessage))
                done()
            })
        })
        it("Autopilot ON, Sell, previous ORD", function (done) {
            // Set the market context and balances
            assistant.setAvailableBalance({
                assetA: 0,
                assetB: 1
            })

            assistant.rememberThis('lastSimulatorEngineMessageId', 136)

            // Set the dependencies parameters
            var period = 5 * 60 * 1000 // 5 minutes delay
            var startTime = bot.processDatetime.valueOf() - period // Setting the indicator to current time
            var endTime = bot.processDatetime.valueOf()
            var simulatorEngineRecord = [startTime, endTime, "", 4000, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0.03, 0, 0, 0, 0, 0, 0, 0, 0]

            var simulatorEngineMessage = buildSimulatorEngineMessage(bot.processDatetime.valueOf())
            simulatorEngineMessage.messageType = MESSAGE_TYPE.Order
            simulatorEngineMessage.order.rate = 4000
            simulatorEngineMessage.order.stop = 4100
            simulatorEngineMessage.order.takeProfit = 3900

            var orderMessageMessage = createMessageFromObject(simulatorEngineMessage)
            simulatorEngineRecord.push(orderMessageMessage)
            assistant.setFileMessages([simulatorEngineRecord])

            // Execute the bot
            this.timeout(5000) // The axios call to the cockpit module is taking time to resolve.
            botInstance.setAutopilot(true)
            botInstance.start((result) => {
                assert.isOk('everything', 'everything is ok')
                done()
            })
        })
        it("Autopilot ON, Sell, UPD, no previous ORD", function (done) {
            // Set the market context and balances
            assistant.setAvailableBalance({
                assetA: 0,
                assetB: 1
            })

            // Set the dependencies parameters
            var period = 5 * 60 * 1000 // 5 minutes delay
            var startTime = bot.processDatetime.valueOf() - period // Setting the indicator to current time
            var endTime = bot.processDatetime.valueOf()
            var simulatorEngineRecord = [startTime, endTime, "", 4000, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0.03, 0, 0, 0, 0, 0, 0, 0, 0]

            var simulatorEngineMessage = buildSimulatorEngineMessage(bot.processDatetime.valueOf())
            simulatorEngineMessage.messageType = MESSAGE_TYPE.OrderUpdate
            simulatorEngineMessage.order.rate = 4000
            simulatorEngineMessage.order.stop = 4100
            simulatorEngineMessage.order.takeProfit = 3900

            var orderMessageMessage = createMessageFromObject(simulatorEngineMessage)
            simulatorEngineRecord.push(orderMessageMessage)
            assistant.setFileMessages([simulatorEngineRecord])

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

                var simulatorExecutorOutputMessage = createMessageFromObject(simulatorExecutorMessage)
                var ouput = assistant.getExtraData()
                assert.equal(JSON.stringify(ouput[0]), JSON.stringify(simulatorExecutorOutputMessage))
                done()
            })
        })
    })
    describe("Cockpit Interactions", function () {
        beforeEach(async () => {
            assistant = assistantMock.newAssistantMock()
            botInstance = simulatorExecutor.newUserBot(bot, logger)
            botInstance.initialize(assistant, undefined, (result) => { })
        })
        afterEach(() => {
            botInstance = undefined
            assistant = undefined
        })
        it("Creating new Signal", function (done) {
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

            var orderMessageMessage = createMessageFromObject(simulatorEngineMessage)
            simulatorEngineRecord.push(orderMessageMessage)
            assistant.setFileMessages([simulatorEngineRecord])

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

                var simulatorExecutorOutputMessage = createMessageFromObject(simulatorExecutorMessage)
                var ouput = assistant.getExtraData()
                assert.equal(JSON.stringify(ouput[0]), JSON.stringify(simulatorExecutorOutputMessage))
                done()
            })
        })
        it("Manage Signals in Signaled", function (done) {
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
            simulatorEngineMessage.messageType = MESSAGE_TYPE.OrderUpdate

            var orderMessageMessage = createMessageFromObject(simulatorEngineMessage)
            simulatorEngineRecord.push(orderMessageMessage)
            assistant.setFileMessages([simulatorEngineRecord])

            // Execute the bot
            this.timeout(10000) // The axios call to the cockpit module is taking time to resolve.
            botInstance.start((result) => {
                assert.equal(result, global.DEFAULT_OK_RESPONSE)

                let simulatorExecutorMessage = buildSimulatorExecutorMessage(assistant, bot.processDatetime.valueOf())
                simulatorExecutorMessage.to = MESSAGE_ENTITY.TradingCokpit
                simulatorExecutorMessage.messageType = MESSAGE_TYPE.OrderUpdate
                simulatorExecutorMessage.order.rate = assistant.getMarketRate()
                simulatorExecutorMessage.order.stop = simulatorEngineMessage.order.stop
                simulatorExecutorMessage.order.takeProfit = simulatorEngineMessage.order.takeProfit
                simulatorExecutorMessage.order.direction = ORDER_DIRECTION.Sell
                simulatorExecutorMessage.order.size = assistant.getAvailableBalance().assetB
                simulatorExecutorMessage.order.status = ORDER_STATUS.Signaled
                simulatorExecutorMessage.order.exitOutcome = ''

                var simulatorExecutorOutputMessage = createMessageFromObject(simulatorExecutorMessage)
                var ouput = assistant.getExtraData()
                assert.equal(JSON.stringify(ouput[0]), JSON.stringify(simulatorExecutorOutputMessage))
                done()
            })
        })
        it("Move signal to ManualAuthorized ", async function () {
            await updateToManualAuthorized(bot.processDatetime.valueOf())
        })
        it("Manage Signals in ManualAuthorized", function (done) {
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
            simulatorEngineMessage.messageType = MESSAGE_TYPE.OrderUpdate

            var orderMessageMessage = createMessageFromObject(simulatorEngineMessage)
            simulatorEngineRecord.push(orderMessageMessage)
            assistant.setFileMessages([simulatorEngineRecord])

            // Execute the bot
            this.timeout(10000) // The axios call to the cockpit module is taking time to resolve.
            botInstance.start((result) => {
                assert.equal(result, global.DEFAULT_OK_RESPONSE)
                var ouput = assistant.getExtraData()

                // On this scenario 2 messages are saved by the executor
                // First message
                let simulatorExecutorMessage = buildSimulatorExecutorMessage(assistant, bot.processDatetime.valueOf())
                simulatorExecutorMessage.id = 0
                simulatorExecutorMessage.from = MESSAGE_ENTITY.TradingCokpit
                simulatorExecutorMessage.to = MESSAGE_ENTITY.SimulationExecutor
                simulatorExecutorMessage.messageType = MESSAGE_TYPE.Order
                simulatorExecutorMessage.order.id = ouput[0][5][0]
                simulatorExecutorMessage.order.dateTime = ouput[0][5][2]
                simulatorExecutorMessage.order.rate = assistant.getMarketRate() // On this test case we assume there is no change on the order
                simulatorExecutorMessage.order.stop = simulatorEngineMessage.order.stop
                simulatorExecutorMessage.order.takeProfit = simulatorEngineMessage.order.takeProfit
                simulatorExecutorMessage.order.direction = ORDER_DIRECTION.Sell
                simulatorExecutorMessage.order.size = ouput[0][5][12]
                simulatorExecutorMessage.order.sizeFilled = ouput[0][5][14]
                simulatorExecutorMessage.order.status = ORDER_STATUS.ManualAuthorized
                simulatorExecutorMessage.order.exitOutcome = ''

                var simulatorExecutorOutputMessage = createMessageFromObject(simulatorExecutorMessage)
                assert.equal(JSON.stringify(ouput[0]), JSON.stringify(simulatorExecutorOutputMessage))

                // Second Message
                simulatorExecutorMessage = buildSimulatorExecutorMessage(assistant, bot.processDatetime.valueOf())
                simulatorExecutorMessage.to = MESSAGE_ENTITY.TradingAssistant
                simulatorExecutorMessage.messageType = MESSAGE_TYPE.Order
                simulatorExecutorMessage.dateTime = assistant.getPositions()[0].date.valueOf()
                simulatorExecutorMessage.order.rate = assistant.getMarketRate()
                simulatorExecutorMessage.order.dateTime = assistant.getPositions()[0].date.valueOf()
                simulatorExecutorMessage.order.stop = simulatorEngineMessage.order.stop
                simulatorExecutorMessage.order.takeProfit = simulatorEngineMessage.order.takeProfit
                simulatorExecutorMessage.order.direction = ORDER_DIRECTION.Sell
                simulatorExecutorMessage.order.size = assistant.getAvailableBalance().assetB
                simulatorExecutorMessage.order.status = ORDER_STATUS.Placed
                simulatorExecutorMessage.order.exitOutcome = ''

                simulatorExecutorOutputMessage = createMessageFromObject(simulatorExecutorMessage)
                assert.equal(JSON.stringify(ouput[1]), JSON.stringify(simulatorExecutorOutputMessage))
                done()
            })
        })
        it("Manage Signals in Placed", function (done) {
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
            simulatorEngineMessage.messageType = MESSAGE_TYPE.OrderUpdate

            var orderMessageMessage = createMessageFromObject(simulatorEngineMessage)
            simulatorEngineRecord.push(orderMessageMessage)
            assistant.setFileMessages([simulatorEngineRecord])

            // Execute the bot
            this.timeout(10000) // The axios call to the cockpit module is taking time to resolve.
            botInstance.start((result) => {
                assert.equal(result, global.DEFAULT_OK_RESPONSE)
                var ouput = assistant.getExtraData()

                let simulatorExecutorMessage = buildSimulatorExecutorMessage(assistant, bot.processDatetime.valueOf())
                simulatorExecutorMessage.id = ouput[0][0]
                simulatorExecutorMessage.from = MESSAGE_ENTITY.SimulationExecutor
                simulatorExecutorMessage.to = MESSAGE_ENTITY.TradingCokpit
                simulatorExecutorMessage.messageType = MESSAGE_TYPE.OrderUpdate
                simulatorExecutorMessage.order.id = ouput[0][0]
                simulatorExecutorMessage.order.dateTime = ouput[0][5][2]
                simulatorExecutorMessage.order.rate = assistant.getMarketRate()
                simulatorExecutorMessage.order.stop = simulatorEngineMessage.order.stop
                simulatorExecutorMessage.order.takeProfit = simulatorEngineMessage.order.takeProfit
                simulatorExecutorMessage.order.direction = ORDER_DIRECTION.Sell
                simulatorExecutorMessage.order.size = assistant.getAvailableBalance().assetB
                simulatorExecutorMessage.order.status = ORDER_STATUS.Filled
                simulatorExecutorMessage.order.sizeFilled = -1
                simulatorExecutorMessage.order.exitOutcome = ''

                var simulatorExecutorOutputMessage = createMessageFromObject(simulatorExecutorMessage)
                assert.equal(JSON.stringify(ouput[0]), JSON.stringify(simulatorExecutorOutputMessage))
                done()
            })
        })
    })

})
