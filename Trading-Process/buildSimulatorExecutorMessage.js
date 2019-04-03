function buildBasicSimulatorExecutorMessage() {
  var simulatorExecutorMessage = {}
  simulatorExecutorMessage.id = 0
  simulatorExecutorMessage.from = MESSAGE_ENTITY.SimulationExecutor
  simulatorExecutorMessage.to = MESSAGE_ENTITY.TradingAssistant
  simulatorExecutorMessage.messageType = MESSAGE_TYPE.Order
  simulatorExecutorMessage.dateTime = bot.processDatetime.valueOf()

  simulatorExecutorMessage.order = {}
  simulatorExecutorMessage.order.dateTime = bot.processDatetime.valueOf()
  simulatorExecutorMessage.order.creator = ORDER_CREATOR.SimulationEngine
  simulatorExecutorMessage.order.owner = ORDER_OWNER.User
  simulatorExecutorMessage.order.exchange = global.EXCHANGE_NAME
  simulatorExecutorMessage.order.market = global.MARKET.name
  simulatorExecutorMessage.order.marginEnabled = ORDER_MARGIN_ENABLED.False
  simulatorExecutorMessage.order.type = ORDER_TYPE.Limit
  simulatorExecutorMessage.order.status = ORDER_STATUS.Placed
  simulatorExecutorMessage.order.sizeFilled = 0
  simulatorExecutorMessage.order.exitOutcome = ''

  return simulatorExecutorMessage
}
