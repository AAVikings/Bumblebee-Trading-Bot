const { orderMessage } = require("@superalgos/mqservice")
const {
    MESSAGE_ENTITY, MESSAGE_TYPE, ORDER_CREATOR, ORDER_TYPE, ORDER_OWNER,
    ORDER_DIRECTION, ORDER_STATUS, ORDER_EXIT_OUTCOME, ORDER_MARGIN_ENABLED
  } = orderMessage.newOrderMessage()

exports.buildSimulatorExecutorMessage = function (assistant, processDatetime) {
    var positions = assistant.getPositions()
    var position = positions.length > 0 ? positions[0] : false

    var simulatorExecutorMessage = {}
    simulatorExecutorMessage.id = position ? position.id : 0
    simulatorExecutorMessage.from = MESSAGE_ENTITY.SimulationExecutor
    simulatorExecutorMessage.to = MESSAGE_ENTITY.TradingAssistant
    simulatorExecutorMessage.messageType = MESSAGE_TYPE.Order
    simulatorExecutorMessage.dateTime = processDatetime

    simulatorExecutorMessage.order = {}
    simulatorExecutorMessage.order.id = simulatorExecutorMessage.id
    simulatorExecutorMessage.order.creator = ORDER_CREATOR.SimulationEngine
    simulatorExecutorMessage.order.dateTime = processDatetime
    simulatorExecutorMessage.order.owner = ORDER_OWNER.User
    simulatorExecutorMessage.order.exchange = global.EXCHANGE_NAME
    simulatorExecutorMessage.order.market = global.MARKET.name
    simulatorExecutorMessage.order.marginEnabled = ORDER_MARGIN_ENABLED.False
    simulatorExecutorMessage.order.type = ORDER_TYPE.Limit
    simulatorExecutorMessage.order.rate = position ? position.rate : 0
    simulatorExecutorMessage.order.stop = 4100
    simulatorExecutorMessage.order.takeProfit = 3900
    simulatorExecutorMessage.order.direction = ORDER_DIRECTION.Buy
    simulatorExecutorMessage.order.size = assistant.getAvailableBalance().assetA
    simulatorExecutorMessage.order.status = ORDER_STATUS.Placed
    simulatorExecutorMessage.order.sizeFilled = 0
    simulatorExecutorMessage.order.exitOutcome = ORDER_EXIT_OUTCOME.StopLoss

    return simulatorExecutorMessage
}
