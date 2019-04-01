exports.newUserBot = function newUserBot(bot, logger, COMMONS_MODULE) {

  // Variable used for logs, which will be passed to the logger instance
  const MODULE_NAME = 'User Bot'
  const LOG_INFO = true
  let assistant, fileStorage

  const {
    MESSAGE_ENTITY, MESSAGE_TYPE, ORDER_CREATOR, ORDER_TYPE, ORDER_OWNER,
    ORDER_DIRECTION, ORDER_STATUS, ORDER_EXIT_OUTCOME, ORDER_MARGIN_ENABLED,
    getRecord, createRecordFromObject
  } = require("@superalgos/mqservice")

  const axios = require('axios')
  const util = require('util')

  /*
    This objects returns two public functions that will be used to integrate
    with the platform.
  */
  let thisObject = {
    initialize: initialize,
    start: start
  }
  return thisObject

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

      // Once Completed we must return the global.DEFAULT_OK_RESPONSE
      callBackFunction(global.DEFAULT_OK_RESPONSE)

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
      let indicatorRecord = getIndicatorRecordFromFile(indicatorFileContent)
      let autopilotResponse = await getAutopilot()

      if (indicatorRecord === undefined) {
        logWarn('start -> Indicator record not found.')
      } else {
        logInfo('start -> Processing indicator record: ' + JSON.stringify(indicatorRecord))
      }

      // Checking Stop Loss
      let assetABalance = assistant.getAvailableBalance().assetA
      let currentRate = assistant.getMarketRate()

      if (indicatorRecord !== undefined && assetABalance > 0 && currentRate >= indicatorRecord.stop) {
        logInfo('manageTradeStopLoss -> Closing trade with Stop Loss.')
        let position = await createBuyPosition(currentRate)

        // Audit Record
        let newRecord = {}
        newRecord.id = position.id
        newRecord.from = MESSAGE_ENTITY.SimulationExecutor
        newRecord.to = MESSAGE_ENTITY.TradingAssistant
        newRecord.messageType = MESSAGE_TYPE.Order
        newRecord.dateTime = position.date

        newRecord.order = {}
        newRecord.order.id = position.id
        newRecord.order.creator = ORDER_CREATOR.SimulationEngine
        newRecord.order.dateTime = position.date
        newRecord.order.owner = ORDER.User
        newRecord.order.exchange = "Poloniex"
        newRecord.order.market = "BTC/USDT"
        newRecord.order.marginEnabled = ORDER_MARGIN_ENABLED.False
        newRecord.order.type = ORDER_TYPE.Limit
        newRecord.order.rate = position.rate
        newRecord.order.stop = indicatorRecord.stop
        newRecord.order.takeProfit = indicatorRecord.takeProfit
        newRecord.order.direction = ORDER_DIRECTION.Buy
        newRecord.order.size = assetABalance
        newRecord.order.status = ORDER_STATUS.Placed
        newRecord.order.sizeFilled = 0
        newRecord.order.exitOutcome = ORDER_EXIT_OUTCOME.StopLoss

        let record = createRecordFromObject(newRecord)
        assistant.addExtraData(record)

        return
      }

      if (autopilotResponse.autopilot) {
        await manageCloneInAutopilotOn(indicatorRecord)
      } else {
        await manageCloneInAutopilotOff(indicatorRecord)
      }
    } catch (error) {
      if (error.stack) logError(JSON.stringify(error.stack))
      throw error
    }
  }

  async function manageCloneInAutopilotOn(indicatorRecord) {
    let assetABalance = assistant.getAvailableBalance().assetA
    let assetBBalance = assistant.getAvailableBalance().assetB
    let currentRate = assistant.getMarketRate()

    if (indicatorRecord.type === "Sell") {
      let position = await createSellPosition(indicatorRecord.rate)

      // Audit Record
      let newRecord = {}
      newRecord.id = position.id
      newRecord.from = MESSAGE_ENTITY.SimulationExecutor
      newRecord.to = MESSAGE_ENTITY.TradingAssistant
      newRecord.messageType = MESSAGE_TYPE.Order
      newRecord.dateTime = position.date

      newRecord.order = {}
      newRecord.order.id = position.id
      newRecord.order.creator = ORDER_CREATOR.SimulationEngine
      newRecord.order.dateTime = position.date
      newRecord.order.owner = ORDER.User
      newRecord.order.exchange = "Poloniex"
      newRecord.order.market = "BTC/USDT"
      newRecord.order.marginEnabled = ORDER_MARGIN_ENABLED.False
      newRecord.order.type = ORDER_TYPE.Limit
      newRecord.order.rate = currentRate
      newRecord.order.stop = indicatorRecord.stop
      newRecord.order.takeProfit = indicatorRecord.takeProfit
      newRecord.order.direction = ORDER_DIRECTION.Sell
      newRecord.order.size = assetBBalance
      newRecord.order.status = ORDER_STATUS.Placed
      newRecord.order.sizeFilled = 0
      newRecord.order.exitOutcome = ''

      let record = createRecordFromObject(newRecord)
      assistant.addExtraData(record)
    } else if (assetBBalance > 0) {
      let position = await createBuyPosition(indicatorRecord.buyOrder)

      // Audit Record
      let newRecord = {}
      newRecord.id = position.id
      newRecord.from = MESSAGE_ENTITY.SimulationExecutor
      newRecord.to = MESSAGE_ENTITY.TradingAssistant
      newRecord.messageType = MESSAGE_TYPE.Order
      newRecord.dateTime = position.date

      newRecord.order = {}
      newRecord.order.id = position.id
      newRecord.order.creator = ORDER_CREATOR.SimulationEngine
      newRecord.order.dateTime = position.date
      newRecord.order.owner = ORDER.User
      newRecord.order.exchange = "Poloniex"
      newRecord.order.market = "BTC/USDT"
      newRecord.order.marginEnabled = ORDER_MARGIN_ENABLED.False
      newRecord.order.type = ORDER_TYPE.Limit
      newRecord.order.rate = currentRate
      newRecord.order.stop = indicatorRecord.stop
      newRecord.order.takeProfit = indicatorRecord.takeProfit
      newRecord.order.direction = ORDER_DIRECTION.Buy
      newRecord.order.size = assetABalance
      newRecord.order.status = ORDER_STATUS.Placed
      newRecord.order.sizeFilled = 0
      newRecord.order.exitOutcome = ''

      let record = createRecordFromObject(newRecord)
      assistant.addExtraData(record)
    } else {
      logInfo("manageCloneInAutopilotOn -> Nothing to do, there isn't a buy or sell opportunity.")
    }
  }

  async function manageCloneInAutopilotOff(indicatorRecord) {
    // If there is any signal not yet approved we update it with the new indicator value
    let assetABalance = assistant.getAvailableBalance().assetA
    let assetBBalance = assistant.getAvailableBalance().assetB
    let currentRate = assistant.getMarketRate()

    let signals = await getSignalsByCloneId("SIGNALED")
    if (signals !== undefined && signals.length > 0) {
      for (let inProcessSignal of signals) {
        logInfo('manageCloneInAutopilotOff -> Signal waiting for approval found, updating it with latest market data.')

        // Audit Record
        let newRecord = {}
        newRecord.id = 0
        newRecord.from = MESSAGE_ENTITY.SimulationExecutor
        newRecord.to = MESSAGE_ENTITY.TradingCokpit
        newRecord.messageType = MESSAGE_TYPE.OrderUpdate
        newRecord.dateTime = bot.processDatetime.valueOf()

        newRecord.order = {}
        newRecord.order.id = 0
        newRecord.order.creator = ORDER_CREATOR.SimulationEngine
        newRecord.order.dateTime = bot.processDatetime.valueOf()
        newRecord.order.owner = ORDER.User
        newRecord.order.exchange = "Poloniex"
        newRecord.order.market = "BTC/USDT"
        newRecord.order.marginEnabled = ORDER_MARGIN_ENABLED.False
        newRecord.order.type = ORDER_TYPE.Limit
        newRecord.order.rate = currentRate
        newRecord.order.stop = indicatorRecord.stop
        newRecord.order.takeProfit = indicatorRecord.takeProfit
        newRecord.order.direction = indicatorRecord.direction
        newRecord.order.size = indicatorRecord.size
        newRecord.order.status = ORDER_STATUS.Signaled
        newRecord.order.sizeFilled = 0
        newRecord.order.exitOutcome = ''

        await updateSignal(inProcessSignal.id, "SIGNALED", "Updating with latest market data.", newRecord.order)

        let record = createRecordFromObject(newRecord)
        assistant.addExtraData(record)
      }
    }

    /**
     * If there is an accepted signal on the cockpit we will proceed to:
     *  1) Save audit containing what we received from the cockpit
     *  2) Execute the order in the market as received
     *  3) Save the audit of the order placed
     *  4) Update the cockpit with the result
    */
    let acceptedSignals = await getSignalsByCloneId("ACCEPTED")
    if (acceptedSignals !== undefined && acceptedSignals.length > 0) {
      for (let acceptedSignal of acceptedSignals) {
        try {
          logInfo('manageCloneInAutopilotOff -> Executing approved signal.')

          // 1) Save audit containing what we received from the cockpit
          let newRecord = {}
          newRecord.id = 0
          newRecord.from = MESSAGE_ENTITY.TradingCokpit
          newRecord.to = MESSAGE_ENTITY.SimulationExecutor
          newRecord.messageType = MESSAGE_TYPE.Order
          newRecord.dateTime = bot.processDatetime.valueOf()
          newRecord.order = acceptedSignal.orderData // we save the order as received
          let record = createRecordFromObject(newRecord)
          assistant.addExtraData(record)

          // 2) Execute the order in the market as received
          let position = await createSellPosition(acceptedSignal.orderData.rate, acceptedSignal.orderData.size)

          // 3) Save the audit of the order placed
          newRecord = {}
          newRecord.id = position.id
          newRecord.from = MESSAGE_ENTITY.SimulationExecutor
          newRecord.to = MESSAGE_ENTITY.TradingAssistant
          newRecord.messageType = MESSAGE_TYPE.Order
          newRecord.dateTime = position.date

          newRecord.order = acceptedSignal.orderData
          newRecord.order.id = position.id
          newRecord.order.dateTime = position.date
          newRecord.order.rate = position.rate
          newRecord.order.size = position.amountB
          newRecord.order.status = ORDER_STATUS.Placed
          newRecord.order.sizeFilled = 0

          // 4) Update the cockpit with the result
          await updateSignal(acceptedSignal.id, "IN_PROCESS", "Order was placed in the market.", newRecord.order)

          record = createRecordFromObject(newRecord)
          assistant.addExtraData(record)
        } catch (error) {
          // Update the cockpit with the error
          let newRecord = {}
          newRecord.id = 0
          newRecord.from = MESSAGE_ENTITY.SimulationExecutor
          newRecord.to = MESSAGE_ENTITY.TradingCokpit
          newRecord.messageType = MESSAGE_TYPE.Order
          newRecord.dateTime = bot.processDatetime.valueOf()

          newRecord.order = acceptedSignal.orderData.rate

          await updateSignal(acceptedSignal.id, "FAILED", "Failed to put the order on the exchange: " + marketOrderResult.error, newRecord.order)

          // Update the audit with the error
          let record = createRecordFromObject(newRecord)
          assistant.addExtraData(record)
        }
      }
    }

    /**
     * If there is an in process signal on the cockpit we will proceed to:
     *  1) Check order status on the market
     *  2) Save the audit of the status
     *  3) Update the cockpit with the results
    */
    let inProcessSignals = await getSignalsByCloneId("IN_PROCESS")
    if (inProcessSignals !== undefined && inProcessSignals.length > 0) {
      for (let inProcessSignal of inProcessSignals) {
        logInfo('manageCloneInAutopilotOff -> Checking in process signal.')
        // 1) Check order status on the market
        let position = checkSignalCompletion()
        if (position) {
          // 2) Save the audit of the status
          let newRecord = {}
          newRecord.id = position.id
          newRecord.from = MESSAGE_ENTITY.TradingAssistant
          newRecord.to = MESSAGE_ENTITY.SimulationExecutor
          newRecord.messageType = MESSAGE_TYPE.Order
          newRecord.dateTime = position.date

          newRecord.order = inProcessSignal.orderData
          newRecord.order.status = ORDER_STATUS.Filled
          newRecord.order.sizeFilled = 'All'

          // 3) Update the cockpit with the results
          await updateSignal(inProcessSignal.id, "PROCESSED", "The order was executed on the market.", newRecord.order)

          let record = createRecordFromObject(newRecord)
          assistant.addExtraData(record)
        } else {
          // Otherwise: Save the audit of the order status, wichs is currently saved by the trading process
        }
      }
    }

    /**
     *  Finally:
     *  1) Check if it's needed to create a new signal based on the indicator
     *  2) Save the audit record for the received info from Trading Simulator
     *  3) Create the signal on the cockpit
    */
    if (indicatorRecord !== undefined && indicatorRecord.type === "Sell") {
      logInfo('manageCloneInAutopilotOff -> Creating new signal.')

      // 2) Save the audit record for the received info from Trading Simulator
      let newRecord = {}
      newRecord.id = 0
      newRecord.from = MESSAGE_ENTITY.SimulationExecutor
      newRecord.to = MESSAGE_ENTITY.TradingCokpit
      newRecord.messageType = MESSAGE_TYPE.Order
      newRecord.dateTime = bot.processDatetime.valueOf()

      newRecord.order = indicatorRecord.order
      newRecord.order.rate = currentRate
      newRecord.order.size = assetBBalance

      let record = createRecordFromObject(newRecord)
      assistant.addExtraData(record)

      // 3) Create the signal on the cockpit
      await createSignal(context, newRecord)
    } else {
      logWarn("manageCloneInAutopilotOff -> Nothing to do, there isn't a buy or sell opportunity.")
    }
  }

  async function createBuyPosition(currentRate) {
    try {
      let amountA = assistant.getAvailableBalance().assetA
      let amountB = Number((amountA / currentRate).toFixed(8))

      if (amountA > 0) {
        logInfo('createBuyPosition -> Put a new BUY position at price: $' + Number(currentRate).toLocaleString())

        assistant.putPosition[util.promisify.custom] = n => new Promise((resolve, reject) => {
          assistant.putPosition('buy', currentRate, amountA, amountB, (result, position) => {
            if (result !== global.DEFAULT_OK_RESPONSE) {
              reject(result)
            } else {
              resolve(position)
            }
          })
        })

        let putPosition = util.promisify(fassistant.putPosition)
        let position = await putPosition('buy', currentRate, amountA, amountB)
        return position
      } else {
        logInfo('createBuyPosition -> Not enough available balance to buy.')
      }
    } catch (error) {
      logError('createBuyPosition -> err = ' + error.message)
      throw error
    }
  }

  async function createSellPosition(currentRate, amountB) {
    try {
      let assetBBalance = assistant.getAvailableBalance().assetB
      // let amountB = assistant.getAvailableBalance().assetB
      let amountA = amountB * currentRate

      if (assetBBalance > 0) {
        logInfo('createSellPosition -> Put a new SELL position at price: $' + Number(currentRate).toLocaleString())
        assistant.putPosition[util.promisify.custom] = n => new Promise((resolve, reject) => {
          assistant.putPosition('buy', currentRate, amountA, amountB, (result, position) => {
            if (result !== global.DEFAULT_OK_RESPONSE) {
              reject(result)
            } else {
              resolve(position)
            }
          })
        })

        let putPosition = util.promisify(fassistant.putPosition)
        let position = await putPosition('sell', currentRate, amountA, amountB)
        return position
      } else {
        logInfo('createSellPosition -> There is not enough available balance to sell.')
      }
    } catch (error) {
      logError('createSellPosition -> error = ' + error.message)
      throw error
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

  function getIndicatorRecordFromFile(indicatorFileContent) {
    try {
      let lastIndexIndicatorFile = indicatorFileContent.length - 1
      let lastAvailableDateTime = indicatorFileContent[lastIndexIndicatorFile][0]

      if (bot.processDatetime.valueOf() <= lastAvailableDateTime || !isExecutionToday()) {
        for (let i = 0; i < indicatorFileContent.length; i++) {
          if (bot.processDatetime.valueOf() >= indicatorFileContent[i][0] && bot.processDatetime.valueOf() < indicatorFileContent[i][1]) {
            return getRecord(indicatorFileContent[i])
          }
        }

        logWarn('getIndicatorRecordFromFile -> The expected Indicator Record was not found: ' + bot.processDatetime.valueOf())
      } else {
        // Running live we will process last available Indicator Record only if it's delayed 25 minutes top
        let maxTolerance = 25 * 60 * 1000
        if (bot.processDatetime.valueOf() <= (lastAvailableDateTime + maxTolerance)) {
          return getRecord(indicatorFileContent[lastIndexIndicatorFile])
        } else {
          logWarn('getIndicatorRecordFromFile -> Available candle older than 25 minutes. Skipping execution.')
        }
      }
    } catch (error) {
      logError('getIndicatorRecordFromFile -> error = ' + error.message)
      throw error
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
  async function getSignalsByCloneId(state) {
    try {
      const cockPit = await axios({
        url: process.env.GATEWAY_ENDPOINT,
        method: 'post',
        data: {
          query: `
            query($cloneId: String!, $state: cockpit_SignalStateEnum){
              cockpit_SignalsByCloneId(cloneId: $cloneId, state:$state){
                id
                state
                cloneId
                orderData
              }
            }
            `,
          variables: {
            cloneId: process.env.CLONE_ID,
            state: state
          },
        },
        headers: {
          authorization: 'Bearer ' + global.ACCESS_TOKEN
        }
      })

      if (cockPit.data.errors) {
        throw new Error(cockPit.data.errors[0].message)
      } else {
        logInfo("getSignalsByCloneId -> Ok: " + state)
        return cockPit.data.data.cockpit_SignalsByCloneId
      }

    } catch (error) {
      logError('getSignalsByCloneId error: ' + error)
      throw error
    }
  }

  async function updateSignal(signalId, state, reason, orderData) {
    try {
      const cockPit = await axios({
        url: process.env.GATEWAY_ENDPOINT,
        method: 'post',
        data: {
          query: `
              mutation ($signalId: ID!, $state: cockpit_SignalStateEnum, $reason:cockpit_JSON, $orderData:cockpit_JSON){
                cockpit_UpdateSignal(
                  id: $signalId
                  state: $state
                  reason: $reason
                  orderData: $orderData
                ) {
                  id
                  state
                  cloneId
                }
              }
              `,
          variables: {
            signalId: signalId,
            state: state,
            reason: reason,
            orderData: orderData
          },
        },
        headers: {
          authorization: 'Bearer ' + global.ACCESS_TOKEN
        }
      })

      if (cockPit.data.errors) {
        throw new Error(cockPit.data.errors[0].message)
      } else {
        logInfo('updateSignal -> Ok.')
        return cockPit.data.data.cockpit_UpdateSignal
      }
    } catch (error) {
      logError('updateSignal error: ' + error)
      throw error
    }
  }

  async function createSignal(orderData) {
    try {
      const cockPit = await axios({
        url: process.env.GATEWAY_ENDPOINT,
        method: 'post',
        data: {
          query: `
            mutation ($state: cockpit_SignalStateEnum!, $cloneId: String!, $orderData:cockpit_JSON, ){
              cockpit_CreateSignal(
                state: $state
                cloneId: $cloneId
                context: $context
                orderData: $orderData
              ) {
                id
                state
                cloneId
              }
            }
            `,
          variables: {
            state: "SIGNALED",
            cloneId: process.env.CLONE_ID,
            orderData: orderData
          },
        },
        headers: {
          authorization: 'Bearer ' + global.ACCESS_TOKEN
        }
      })

      if (cockPit.data.errors) {
        throw new Error(cockPit.data.errors[0].message)
      } else {
        logInfo('createSignal -> Ok.')
        return cockPit.data.data.cockpit_CreateSignal
      }

    } catch (error) {
      logger.write(MODULE_NAME, "[INFO] createSignal error: " + error)
      throw error
    }
  }

  async function getAutopilot() {
    try {
      const cockPit = await axios({
        url: process.env.GATEWAY_ENDPOINT,
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
          authorization: 'Bearer ' + global.ACCESS_TOKEN
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
      throw error
    }
  }

  async function getFileContent(containerName, blobName) {
    fileStorage.getTextFile[util.promisify.custom] = n => new Promise((resolve, reject) => {
      fileStorage.getTextFile(containerName, blobName, (result, fileContent) => {
        if (result !== global.DEFAULT_OK_RESPONSE) {
          console.log('[WARN] getFileContent -> The indicator dependency is not ready. Will retry later.')
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

}
