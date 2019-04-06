const { orderMessage } = require("@superalgos/mqservice")
const {
    MESSAGE_ENTITY, MESSAGE_TYPE, ORDER_CREATOR, ORDER_TYPE,
    ORDER_OWNER, ORDER_DIRECTION, ORDER_STATUS, ORDER_MARGIN_ENABLED
  } = orderMessage.newOrderMessage()

exports.buildSimulatorEngineMessage = function (processDatetime) {
    var simulatorEngineMessage = {}
    simulatorEngineMessage.id = 136
    simulatorEngineMessage.from = MESSAGE_ENTITY.SimulationEngine
    simulatorEngineMessage.to = MESSAGE_ENTITY.SimulationExecutor
    simulatorEngineMessage.messageType = MESSAGE_TYPE.OrderUpdate
    simulatorEngineMessage.dateTime = processDatetime

    simulatorEngineMessage.order = {}
    simulatorEngineMessage.order.id = simulatorEngineMessage.id
    simulatorEngineMessage.order.creator = ORDER_CREATOR.SimulationEngine
    simulatorEngineMessage.order.dateTime = processDatetime
    simulatorEngineMessage.order.owner = ORDER_OWNER.User
    simulatorEngineMessage.order.exchange = global.EXCHANGE_NAME
    simulatorEngineMessage.order.market = global.MARKET.name
    simulatorEngineMessage.order.marginEnabled = ORDER_MARGIN_ENABLED.False
    simulatorEngineMessage.order.type = ORDER_TYPE.Limit
    simulatorEngineMessage.order.rate = 4000
    simulatorEngineMessage.order.stop = 4100
    simulatorEngineMessage.order.takeProfit = 3900
    simulatorEngineMessage.order.direction = ORDER_DIRECTION.Sell
    simulatorEngineMessage.order.size = "All"
    simulatorEngineMessage.order.status = ORDER_STATUS.Signaled
    simulatorEngineMessage.order.sizeFilled = 0
    simulatorEngineMessage.order.exitOutcome = ""

    return simulatorEngineMessage
}
