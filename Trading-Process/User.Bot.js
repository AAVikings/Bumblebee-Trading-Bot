exports.newUserBot = function newUserBot(bot, logger) {

  // Variable used for logs, which will be passed to the logger instance
  const MODULE_NAME = 'User Bot'
  const LOG_INFO = true
  let assistant, fileStorage
  let autopilotControl = false

  const orderMessage = require("@superalgos/mqservice/orderMessage/orderMessage")

  const {
    MESSAGE_ENTITY, MESSAGE_TYPE, ORDER_CREATOR, ORDER_TYPE, ORDER_OWNER,
    ORDER_DIRECTION, ORDER_STATUS, ORDER_EXIT_OUTCOME, ORDER_MARGIN_ENABLED,
    getMessage, createMessageFromObject
  } = orderMessage.newOrderMessage()

  const axios = require('axios')
  const util = require('util')

  /*
    This objects returns two public functions that will be used to integrate with the platform.
  */
  return {
    initialize: initialize,
    start: start,
    setAutopilot: setAutopilot
  }

  function initialize(pAssistant, pGenes, callBackFunction) {
    try {
      logInfo('initialize -> Entering function.')

      // Integration with platform logger, when running on cloud
      logger.fileName = MODULE_NAME
      assistant = pAssistant

      if (bot.timePeriodFileStorage === undefined) {
        throw new Error("Execution Parameter Time Period not defined.")
      }

      if (bot.dataSet === undefined) {
        throw new Error("Execution Parameter Data Set not defined.")
      }

      let key = bot.devTeam + '-simulator-' + bot.codeName + '-Trading-Simulation-' + bot.dataSet + '-dataSet.V1'
      fileStorage = assistant.dataDependencies.dataSets.get(key)

      if (fileStorage !== undefined) {
        assistant.rememberThis('lastSimulatorEngineMessageId', 0)
        assistant.rememberThis('lastStopLoss', 0)
        assistant.rememberThis('lastTakeProfit', 0)
        callBackFunction(global.DEFAULT_OK_RESPONSE)
      } else {
        logError('initialize -> Failed to initialize storage. Key not found:' + key)
        callBackFunction(global.DEFAULT_FAIL_RESPONSE)
      }
    } catch (error) {
      logError('initialize -> onDone -> err = ' + error.message)
      callBackFunction(global.DEFAULT_FAIL_RESPONSE)
    }
  }

  function logInfo(message) {
    if (LOG_INFO === true) { logger.write(MODULE_NAME, '[INFO] ' + message) }
  }

  function logWarn(message) {
    if (LOG_INFO === true) { logger.write(MODULE_NAME, '[WARN] ' + message) }
  }

  function logError(message) {
    logger.write(MODULE_NAME, '[ERROR] ' + message)
  }

  function setAutopilot(autopilot) {
    autopilotControl = autopilot
  }

  /*
    The start function is called by the platform for executing the bot every 1 minute
  */
  function start(callBackFunction) {
    logInfo('start -> Entering function.')

    const callback = util.callbackify(executorLogic)

    callback((err, ret) => {
      if (err) {
        callBackFunction(err)
      } else {
        callBackFunction(global.DEFAULT_OK_RESPONSE)
      }
    })
  }

  async function executorLogic() {
    try {
      let indicatorFileContent = await getIndicatorFile()
      let simulatorEngineMessage = getSimulatorEngineMessageFromFile(indicatorFileContent)
      let autopilotResponse = await getAutopilot()

      let stopLoss, takeProfit
      if (simulatorEngineMessage === undefined) {
        logWarn('start -> Simulator message not available. Will proceed to check SL and TP from previous execution.')
        stopLoss = assistant.remindMeOf('lastStopLoss')
        takeProfit = assistant.remindMeOf('lastTakeProfit')
      } else {
        logInfo('Processing simulator record: ' + JSON.stringify(simulatorEngineMessage))
        stopLoss = simulatorEngineMessage.order.stop
        takeProfit = simulatorEngineMessage.order.takeProfit
      }

      // Checking Stop Loss
      let assetABalance = assistant.getAvailableBalance().assetA
      let currentRate = assistant.getMarketRate()

      if (stopLoss > 0 && assetABalance > 0 && currentRate >= stopLoss) {
        logInfo('Closing trade with Stop Loss.')
        try {
          let position = await createBuyPosition(currentRate)

          let simulatorExecutorMessage = buildBasicSimulatorExecutorMessage()
          simulatorExecutorMessage.id = position.id
          simulatorExecutorMessage.order.id = position.id
          simulatorExecutorMessage.order.rate = currentRate
          simulatorExecutorMessage.order.stop = stopLoss
          simulatorExecutorMessage.order.takeProfit = takeProfit
          simulatorExecutorMessage.order.direction = ORDER_DIRECTION.Buy
          simulatorExecutorMessage.order.size = assetABalance
          simulatorExecutorMessage.order.status = ORDER_STATUS.Placed
          simulatorExecutorMessage.order.exitOutcome = ORDER_EXIT_OUTCOME.StopLoss

          let message = createMessageFromObject(simulatorExecutorMessage)
          assistant.addExtraData(message)
          assistant.rememberThis('lastSimulatorEngineMessageId', 0)
          assistant.rememberThis('lastStopLoss', 0)
          assistant.rememberThis('lastTakeProfit', 0)
        } catch (error) {
          let simulatorExecutorMessage = buildBasicSimulatorExecutorMessage()
          simulatorExecutorMessage.from = MESSAGE_ENTITY.TradingAssistant
          simulatorExecutorMessage.to = MESSAGE_ENTITY.SimulationExecutor
          simulatorExecutorMessage.order.rate = position.rate
          simulatorExecutorMessage.order.stop = stopLoss
          simulatorExecutorMessage.order.takeProfit = takeProfit
          simulatorExecutorMessage.order.direction = ORDER_DIRECTION.Buy
          simulatorExecutorMessage.order.size = assetABalance
          simulatorExecutorMessage.order.status = ORDER_STATUS.Rejected

          let message = createMessageFromObject(simulatorExecutorMessage)
          assistant.addExtraData(message)
        } finally {
          return
        }
      }

      // Checking Take Profits
      if (takeProfit > 0 && assetABalance > 0 && currentRate <= takeProfit) {
        logInfo('Closing trade with Take Profit.')
        try {
          let position = await createBuyPosition(currentRate, assetABalance)

          let simulatorExecutorMessage = buildBasicSimulatorExecutorMessage()
          simulatorExecutorMessage.id = position.id
          simulatorExecutorMessage.order.id = position.id
          simulatorExecutorMessage.order.rate = currentRate
          simulatorExecutorMessage.order.stop = stopLoss
          simulatorExecutorMessage.order.takeProfit = takeProfit
          simulatorExecutorMessage.order.direction = ORDER_DIRECTION.Buy
          simulatorExecutorMessage.order.size = assetABalance
          simulatorExecutorMessage.order.status = ORDER_STATUS.Placed
          simulatorExecutorMessage.order.exitOutcome = ORDER_EXIT_OUTCOME.TakeProfit

          let message = createMessageFromObject(simulatorExecutorMessage)
          assistant.addExtraData(message)
          assistant.rememberThis('lastSimulatorEngineMessageId', 0)
          assistant.rememberThis('lastStopLoss', 0)
          assistant.rememberThis('lastTakeProfit', 0)
        } catch (error) {
          let simulatorExecutorMessage = buildBasicSimulatorExecutorMessage()
          simulatorExecutorMessage.from = MESSAGE_ENTITY.TradingAssistant
          simulatorExecutorMessage.to = MESSAGE_ENTITY.SimulationExecutor
          simulatorExecutorMessage.order.rate = currentRate
          simulatorExecutorMessage.order.stop = stopLoss
          simulatorExecutorMessage.order.takeProfit = takeProfit
          simulatorExecutorMessage.order.direction = ORDER_DIRECTION.Buy
          simulatorExecutorMessage.order.size = assetABalance
          simulatorExecutorMessage.order.status = ORDER_STATUS.Rejected

          let message = createMessageFromObject(simulatorExecutorMessage)
          assistant.addExtraData(message)
        } finally {
          return
        }
      }

      if (simulatorEngineMessage !== undefined) {
        if (autopilotResponse.autopilot || autopilotControl) {
          await manageCloneInAutopilotOn(simulatorEngineMessage)
        } else {
          await manageCloneInAutopilotOff(simulatorEngineMessage)
        }
      }
    } catch (error) {
      logError('Error on executorLogic: ' + error)
      logError('Stack: ' + JSON.stringify(error.stack))
      throw error
    }
  }

  async function manageCloneInAutopilotOn(simulatorEngineMessage) {
    let assetBBalance = assistant.getAvailableBalance().assetB
    let currentRate = assistant.getMarketRate()

    if (simulatorEngineMessage.messageType === MESSAGE_TYPE.Order
      && simulatorEngineMessage.order.direction === ORDER_DIRECTION.Sell) {

      let lastSimulatorEngineMessageId = assistant.remindMeOf('lastSimulatorEngineMessageId')
      if (lastSimulatorEngineMessageId >= simulatorEngineMessage.id) {
        logInfo("manageCloneInAutopilotOn -> Order message was previously processed.")
        return
      }

      try {
        let position = await createSellPosition(currentRate, assetBBalance)
        let simulatorExecutorMessage = buildBasicSimulatorExecutorMessage()
        simulatorExecutorMessage.id = position.id
        simulatorExecutorMessage.order.id = position.id
        simulatorExecutorMessage.order.rate = currentRate
        simulatorExecutorMessage.order.stop = simulatorEngineMessage.order.stop
        simulatorExecutorMessage.order.takeProfit = simulatorEngineMessage.order.takeProfit
        simulatorExecutorMessage.order.direction = ORDER_DIRECTION.Sell
        simulatorExecutorMessage.order.size = assetBBalance

        let message = createMessageFromObject(simulatorExecutorMessage)
        assistant.addExtraData(message)
        assistant.rememberThis('lastSimulatorEngineMessageId', parseInt(simulatorEngineMessage.id))
        assistant.rememberThis('lastStopLoss', simulatorEngineMessage.order.stop)
        assistant.rememberThis('lastTakeProfit', simulatorEngineMessage.order.takeProfit)
      } catch (error) {
        let simulatorExecutorMessage = buildBasicSimulatorExecutorMessage()
        simulatorExecutorMessage.from = MESSAGE_ENTITY.TradingAssistant
        simulatorExecutorMessage.to = MESSAGE_ENTITY.SimulationExecutor
        simulatorExecutorMessage.messageType = MESSAGE_TYPE.Order
        simulatorExecutorMessage.order.rate = currentRate
        simulatorExecutorMessage.order.stop = simulatorEngineMessage.order.stop
        simulatorExecutorMessage.order.takeProfit = simulatorEngineMessage.order.takeProfit
        simulatorExecutorMessage.order.direction = ORDER_DIRECTION.Sell
        simulatorExecutorMessage.order.size = assetBBalance
        simulatorExecutorMessage.order.status = ORDER_STATUS.Rejected

        let message = createMessageFromObject(simulatorExecutorMessage)
        assistant.addExtraData(message)
      }
    } else {
      logInfo("manageCloneInAutopilotOn -> Nothing to do, there isn't a buy or sell opportunity.")
    }
  }

  async function manageCloneInAutopilotOff(simulatorEngineMessage) {
    /**
    * If there is a ManualAuthorized order on the cockpit we will proceed to:
    *  1) Save an audit containing what we received from the cockpit
    *  2) Execute the order in the market as received
    *  3) Save the audit of the order placed
    *  4) Update the cockpit with the result
   */
    let acceptedSignals = await getSignalsByCloneId(ORDER_STATUS.ManualAuthorized)
    if (acceptedSignals !== undefined && acceptedSignals.length > 0) {
      for (let acceptedSignal of acceptedSignals) {
        try {
          logInfo('manageCloneInAutopilotOff -> Executing manual authorized signal.')

          // 1) Save audit containing what we received from the cockpit
          let simulatorExecutorMessage = buildBasicSimulatorExecutorMessage()
          simulatorExecutorMessage.id = 0
          simulatorExecutorMessage.from = MESSAGE_ENTITY.TradingCokpit
          simulatorExecutorMessage.to = MESSAGE_ENTITY.SimulationExecutor
          simulatorExecutorMessage.order = acceptedSignal.orderData // we save the order as received
          simulatorExecutorMessage.order.status = ORDER_STATUS.ManualAuthorized
          let message = createMessageFromObject(simulatorExecutorMessage)
          assistant.addExtraData(message)

          // 2) Execute the order in the market as received
          let position = await createSellPosition(acceptedSignal.orderData.rate, acceptedSignal.orderData.size)

          // 3) Save the audit of the order placed
          simulatorExecutorMessage = buildBasicSimulatorExecutorMessage()
          simulatorExecutorMessage.id = position.id
          simulatorExecutorMessage.from = MESSAGE_ENTITY.SimulationExecutor
          simulatorExecutorMessage.to = MESSAGE_ENTITY.TradingAssistant
          simulatorExecutorMessage.dateTime = position.date

          simulatorExecutorMessage.order = acceptedSignal.orderData
          simulatorExecutorMessage.order.id = position.id
          simulatorExecutorMessage.order.dateTime = position.date
          simulatorExecutorMessage.order.rate = position.rate
          simulatorExecutorMessage.order.size = position.amountB
          simulatorExecutorMessage.order.status = ORDER_STATUS.Placed
          simulatorExecutorMessage.order.sizeFilled = 0

          // 4) Update the cockpit with the result
          await updateSignal(acceptedSignal.id, simulatorExecutorMessage)

          message = createMessageFromObject(simulatorExecutorMessage)
          assistant.addExtraData(message)
          return
        } catch (error) {
          // Update the cockpit with the error
          let simulatorExecutorMessage = buildBasicSimulatorExecutorMessage()
          simulatorExecutorMessage.id = 0
          simulatorExecutorMessage.from = MESSAGE_ENTITY.SimulationExecutor
          simulatorExecutorMessage.to = MESSAGE_ENTITY.TradingCokpit
          simulatorExecutorMessage.messageType = MESSAGE_TYPE.Order
          simulatorExecutorMessage.dateTime = bot.processDatetime.valueOf()
          simulatorExecutorMessage.order.status = ORDER_STATUS.Rejected

          simulatorExecutorMessage.order = acceptedSignal.order

          await updateSignal(acceptedSignal.id, simulatorExecutorMessage)

          // Update the audit with the error
          let message = createMessageFromObject(simulatorExecutorMessage)
          assistant.addExtraData(message)
          return
        }
      }
    }

    /**
    * If there is a Placed order on the cockpit we will proceed to:
    *  1) Check order status on the market
    *  2) Save the audit of the status
    *  3) Update the cockpit with the results
   */
    let inProcessSignals = await getSignalsByCloneId(ORDER_STATUS.Placed)
    if (inProcessSignals !== undefined && inProcessSignals.length > 0) {
      for (let inProcessSignal of inProcessSignals) {
        logInfo('manageCloneInAutopilotOff -> Checking in process signal.')
        // 1) Check order status on the market
        let position = checkSignalCompletion()
        if (position || position === undefined) {
          // 2) Save the audit of the status
          let simulatorExecutorMessage = buildBasicSimulatorExecutorMessage()
          simulatorExecutorMessage.id = inProcessSignal.orderData.id
          simulatorExecutorMessage.from = MESSAGE_ENTITY.SimulationExecutor
          simulatorExecutorMessage.to = MESSAGE_ENTITY.TradingCokpit
          simulatorExecutorMessage.messageType = MESSAGE_TYPE.OrderUpdate

          simulatorExecutorMessage.order = inProcessSignal.orderData
          simulatorExecutorMessage.order.status = ORDER_STATUS.Filled
          simulatorExecutorMessage.order.sizeFilled = -1

          // 3) Update the cockpit with the results
          await updateSignal(inProcessSignal.id, simulatorExecutorMessage)

          let message = createMessageFromObject(simulatorExecutorMessage)
          assistant.addExtraData(message)
        } else {
          // Otherwise: Save the audit of the order status, wichs is currently saved by the trading process
        }
        return
      }
    }

    /**
     * If there is any signal not yet authorized:
     *  1) Update the signal with the new indicator value on the cockpit
     *  3) Save the audit of the message sent
    */
    let assetBBalance = assistant.getAvailableBalance().assetB
    let currentRate = assistant.getMarketRate()
    let signals = await getSignalsByCloneId(ORDER_STATUS.Signaled)
    if (signals !== undefined && signals.length > 0) {
      for (let inProcessSignal of signals) {
        logInfo('manageCloneInAutopilotOff -> Signal waiting for approval found, updating it with latest market data.')

        let simulatorExecutorMessage = buildBasicSimulatorExecutorMessage()
        simulatorExecutorMessage.to = MESSAGE_ENTITY.TradingCokpit
        simulatorExecutorMessage.messageType = MESSAGE_TYPE.OrderUpdate
        simulatorExecutorMessage.order.id = 0
        simulatorExecutorMessage.order.rate = currentRate
        simulatorExecutorMessage.order.stop = simulatorEngineMessage.order.stop
        simulatorExecutorMessage.order.takeProfit = simulatorEngineMessage.order.takeProfit
        simulatorExecutorMessage.order.direction = simulatorEngineMessage.order.direction
        simulatorExecutorMessage.order.size = assetBBalance
        simulatorExecutorMessage.order.status = ORDER_STATUS.Signaled

        await updateSignal(inProcessSignal.id, simulatorExecutorMessage)

        let message = createMessageFromObject(simulatorExecutorMessage)
        assistant.addExtraData(message)
        return
      }
    }

    /**
     *  Finally:
     *  1) Check if it's needed to create a new signal based on the indicator
     *  2) Save the audit message for the received info from Trading Simulator
     *  3) Create the signal on the cockpit
    */
    if (simulatorEngineMessage !== undefined && simulatorEngineMessage.messageType === MESSAGE_TYPE.Order
      && simulatorEngineMessage.order.direction === ORDER_DIRECTION.Sell) {
      logInfo('Creating new signal.')

      // 2) Save the audit message for the received info from Trading Simulator
      let simulatorExecutorMessage = buildBasicSimulatorExecutorMessage()
      simulatorExecutorMessage.id = 0
      simulatorExecutorMessage.to = MESSAGE_ENTITY.TradingCokpit
      simulatorExecutorMessage.messageType = MESSAGE_TYPE.Order
      simulatorExecutorMessage.order.id = 0
      simulatorExecutorMessage.order.status = ORDER_STATUS.Signaled
      simulatorExecutorMessage.order.rate = currentRate
      simulatorExecutorMessage.order.direction = ORDER_DIRECTION.Sell
      simulatorExecutorMessage.order.takeProfit = simulatorEngineMessage.order.takeProfit
      simulatorExecutorMessage.order.stop = simulatorEngineMessage.order.stop
      simulatorExecutorMessage.order.size = assetBBalance

      let message = createMessageFromObject(simulatorExecutorMessage)
      assistant.addExtraData(message)

      // 3) Create the signal on the cockpit
      await createSignal(simulatorExecutorMessage)
    } else {
      logWarn("manageCloneInAutopilotOff -> Nothing to do, there isn't a buy or sell opportunity.")
    }
  }

  async function createBuyPosition(currentRate, amountToBuy) {
    if (!amountToBuy) amountToBuy = assistant.getAvailableBalance().assetA
    let amountB = Number((amountToBuy / currentRate).toFixed(8))
    let positions = assistant.getPositions()
    let assetABalance = assistant.getAvailableBalance().assetA

    if (positions.length > 0 && positions[0].type === 'buy' && positions[0].status !== 'executed') {
      logInfo('createBuyPosition -> Moving an existing BUY position to a new price: $' + Number(currentRate).toLocaleString())

      assistant.movePosition[util.promisify.custom] = n => new Promise((resolve, reject) => {
        assistant.movePosition(positions[0], currentRate, (result, position) => {
          if (result !== global.DEFAULT_OK_RESPONSE) {
            reject(result)
          } else {
            resolve(position)
          }
        })
      })

      let movePosition = util.promisify(assistant.movePosition)
      await movePosition(positions[0], currentRate)
      return positions[0]
    } else if (assetABalance > 0) {
      logInfo('createBuyPosition -> Put a new BUY position at price: $' + Number(currentRate).toLocaleString())

      assistant.putPosition[util.promisify.custom] = n => new Promise((resolve, reject) => {
        assistant.putPosition('buy', currentRate, amountToBuy, amountB, (result, position) => {
          if (result !== global.DEFAULT_OK_RESPONSE) {
            reject(result)
          } else {
            resolve(position)
          }
        })
      })

      let putPosition = util.promisify(assistant.putPosition)
      await putPosition('buy', currentRate, amountToBuy, amountB)
      return positions[0]
    } else {
      logInfo('createBuyPosition -> Not enough available balance to buy.')
      throw new Error('There is not enough available balance to buy.')
    }
  }

  async function createSellPosition(currentRate, amountToSell) {
    if (!amountToSell) amountToSell = assistant.getAvailableBalance().assetB
    let amountA = amountToSell * currentRate
    let positions = assistant.getPositions()

    if (positions.length > 0 && positions[0].type === 'sell' && positions[0].status !== 'executed') {
      logInfo('createSellPosition -> Moving an existing SELL position to a new price: $' + Number(currentRate).toLocaleString())

      assistant.movePosition[util.promisify.custom] = n => new Promise((resolve, reject) => {
        assistant.movePosition(positions[0], currentRate, (result, position) => {
          if (result !== global.DEFAULT_OK_RESPONSE) {
            reject(result)
          } else {
            resolve(position)
          }
        })
      })

      let movePosition = util.promisify(assistant.movePosition)
      await movePosition(positions[0], currentRate)
      return positions[0]
    } else if (assistant.getAvailableBalance().assetB > 0) {
      logInfo('createSellPosition -> Put a new SELL position at price: $' + Number(currentRate).toLocaleString())
      assistant.putPosition[util.promisify.custom] = n => new Promise((resolve, reject) => {
        assistant.putPosition('sell', currentRate, amountA, amountToSell, (result, position) => {
          if (result !== global.DEFAULT_OK_RESPONSE) {
            reject(result)
          } else {
            resolve(position)
          }
        })
      })

      let putPosition = util.promisify(assistant.putPosition)
      let position = await putPosition('sell', currentRate, amountA, amountToSell)
      return position
    } else {
      logInfo('createSellPosition -> There is not enough available balance to sell.')
      throw new Error('There is not enough available balance to sell.')
    }
  }

  function checkSignalCompletion() {
    let positions = assistant.getPositions()
    if ((positions.length === 0) || (positions.length > 0 && positions[0].status === 'executed')) {
      logInfo('checkSignalCompletion -> The order was executed.')
      return positions[0]
    } else {
      return false
    }
  }

  // Storage functions
  async function getIndicatorFile() {
    logInfo('getIndicatorFile -> Entering function.')

    let filePath
    if (bot.processes[0].timePeriod > 2700000) {
      // Market Files
      filePath = 'Trading-Simulation/' + bot.dataSet + '/' + bot.timePeriodFileStorage
    } else {
      // Daily Files
      let dateTime = bot.processDatetime
      let datePath = dateTime.getUTCFullYear() + '/' + pad(dateTime.getUTCMonth() + 1, 2) + '/' + pad(dateTime.getUTCDate(), 2)
      filePath = 'Trading-Simulation/' + bot.dataSet + '/' + bot.timePeriodFileStorage + '/' + datePath
    }

    /*
      bot.botCache: allows us to keep a map (key value pairs) between executions,
        so we don't need to go to the storage to retrieve this value.
      If the value already exist on the cache we will get it from there,
      otherwise it will be retrieved from the bot storage.
    */
    if (bot.startMode === 'Backtest' && bot.botCache.has(filePath)) {
      logInfo('getIndicatorFile -> Getting the file from local cache.')
      return bot.botCache.get(filePath)
    } else {
      let indicatorFileContent = await getFileContent(filePath, 'USDT_BTC.json')
      bot.botCache.set(filePath, JSON.parse(indicatorFileContent))
      return JSON.parse(indicatorFileContent)
    }
  }

  function getSimulatorEngineMessageFromFile(indicatorFileContent) {
    try {
      let lastIndexIndicatorFile = indicatorFileContent.length - 1
      let lastAvailableDateTime = indicatorFileContent[lastIndexIndicatorFile][0]

      if (bot.processDatetime.valueOf() <= lastAvailableDateTime || !isExecutionToday()) {
        for (let i = 0; i < indicatorFileContent.length; i++) {
          if (bot.processDatetime.valueOf() >= indicatorFileContent[i][0] && bot.processDatetime.valueOf() < indicatorFileContent[i][1]) {
            return getMessage(indicatorFileContent[i][25])
          }
        }

        logWarn('getSimulatorEngineMessageFromFile -> The indicator message was not found at time: ' + bot.processDatetime.valueOf())
      } else {
        // Running live we will process last available Indicator Message only if it's delayed 10 minutes top
        let maxTolerance = 10 * 60 * 1000
        if (bot.processDatetime.valueOf() <= (lastAvailableDateTime + maxTolerance)) {
          return getMessage(indicatorFileContent[lastIndexIndicatorFile][25])
        } else {
          logWarn('getSimulatorEngineMessageFromFile -> Last available indicator older than 10 minutes.')
        }
      }
    } catch (error) {
      logError('getSimulatorEngineMessageFromFile -> error = ' + error.message)
      throw global.DEFAULT_RETRY_RESPONSE
    }
  }

  // Helper Functions
  function isExecutionToday() {
    let localDate = new Date()
    let today = new Date(Date.UTC(
      localDate.getUTCFullYear(),
      localDate.getUTCMonth(),
      localDate.getUTCDate()))

    return (today.getUTCFullYear() === bot.processDatetime.getUTCFullYear()
      && today.getUTCMonth() === bot.processDatetime.getUTCMonth()
      && today.getUTCDate() === bot.processDatetime.getUTCDate())
  }

  // Modules queries
  async function getSignalsByCloneId(orderStatus) {
    try {
      const cockPit = await axios({
        url: process.env.GATEWAY_ENDPOINT_K8S,
        method: 'post',
        data: {
          query: `
            query($cloneId: String!, $orderStatus: String){
              cockpit_SignalsByCloneId(cloneId: $cloneId, orderStatus:$orderStatus){
                id
                cloneId
                orderId
                orderCreator
                orderStatus
                orderData
              }
            }
            `,
          variables: {
            cloneId: process.env.CLONE_ID,
            orderStatus: orderStatus
          },
        },
        headers: {
          authorization: process.env.AUTHORIZATION
        }
      })

      logInfo("Retrieved signals in status: " + orderStatus)
      return cockPit.data.data.cockpit_SignalsByCloneId

    } catch (error) {
      logError('getSignalsByCloneId error: ' + error.response.data.errors[0])
      throw global.DEFAULT_RETRY_RESPONSE
    }
  }

  async function updateSignal(signalId, message) {
    try {
      const cockPit = await axios({
        url: process.env.GATEWAY_ENDPOINT_K8S,
        method: 'post',
        data: {
          query: `
              mutation ($signalId: ID!, $message:cockpit_JSON!){
                cockpit_UpdateSignal(
                  id: $signalId
                  message: $message
                ) {
                  id
                  cloneId
                  orderStatus
                }
              }
              `,
          variables: {
            signalId: signalId,
            message: message
          },
        },
        headers: {
          authorization: process.env.AUTHORIZATION
        }
      })

      logInfo('updateSignal ok.')
      return cockPit.data.data.cockpit_UpdateSignal
    } catch (error) {
      logError('updateSignal error: ' + error.response.data.errors[0])
      throw global.DEFAULT_RETRY_RESPONSE
    }
  }

  async function createSignal(message) {
    try {
      const cockPit = await axios({
        url: process.env.GATEWAY_ENDPOINT_K8S,
        method: 'post',
        data: {
          query: `
            mutation ($cloneId: String!, $message: cockpit_JSON!){
              cockpit_CreateSignal(
                cloneId: $cloneId
                message: $message
              ) {
                id
                cloneId
                orderStatus
              }
            }
            `,
          variables: {
            cloneId: process.env.CLONE_ID,
            message: message
          },
        },
        headers: {
          authorization: process.env.AUTHORIZATION
        }
      })

      logInfo('createSignal ok.')
      return cockPit.data.data.cockpit_CreateSignal
    } catch (error) {
      logInfo("createSignal error: " + error.response.data.errors[0])
      throw global.DEFAULT_RETRY_RESPONSE
    }
  }

  async function getAutopilot() {
    try {
      const cockPit = await axios({
        url: process.env.GATEWAY_ENDPOINT_K8S,
        method: 'post',
        data: {
          query: `
            query($cloneId: String!){
              cockpit_CloneSettingsByCloneId(cloneId: $cloneId){
                id
                cloneId
                autopilot
              }
            }
            `,
          variables: {
            cloneId: process.env.CLONE_ID
          },
        },
        headers: {
          authorization: process.env.AUTHORIZATION
        }
      })

      if (cockPit.data.errors) {
        throw new Error(cockPit.data.errors[0].message)
      } else {
        logInfo('getAutopilot -> Ok.')
        return cockPit.data.data.cockpit_CloneSettingsByCloneId
      }

    } catch (error) {
      logInfo('getAutopilot error: ' + error)
      throw global.DEFAULT_RETRY_RESPONSE
    }
  }

  async function getFileContent(containerName, blobName) {
    fileStorage.getTextFile[util.promisify.custom] = n => new Promise((resolve, reject) => {
      fileStorage.getTextFile(containerName, blobName, (result, fileContent) => {
        if (result !== global.DEFAULT_OK_RESPONSE) {
          let errorMessage = '[WARN] getFileContent -> The indicator dependency is not ready. Will retry later.'
          console.log(errorMessage)
          logWarn(errorMessage)
          reject(global.DEFAULT_RETRY_RESPONSE)
        } else {
          resolve(fileContent)
        }
      })
    })

    let getTextFile = util.promisify(fileStorage.getTextFile)
    let fileContent = await getTextFile(containerName, blobName)
    return fileContent
  }

  function pad(str, max) {
    str = str.toString()
    return str.length < max ? pad('0' + str, max) : str
  }

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

}
