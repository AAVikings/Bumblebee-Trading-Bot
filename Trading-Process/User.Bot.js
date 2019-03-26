exports.newUserBot = function newUserBot(bot, logger, COMMONS_MODULE) {

  // Variable used for logs, which will be passed to the logger instance
  const MODULE_NAME = 'User Bot'
  const FULL_LOG = true
  const LOG_INFO = true
  let assistant, fileStorage

  const axios = require('axios')

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
      if (LOG_INFO === true) { logger.write(MODULE_NAME, '[INFO] initialize -> Entering function.') }

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
      logger.write(MODULE_NAME, '[ERROR] initialize -> onDone -> err = ' + error.message)
      callBackFunction(global.DEFAULT_FAIL_RESPONSE)
    }
  }

  /*
    The start function is called by the platform for executing the bot every 1 minute
  */
  async function start(callBackFunction) {
    if (LOG_INFO === true) { logger.write(MODULE_NAME, '[INFO] start -> Entering function.') }

    let indicatorFileContent = await getIndicatorFile()
    let indicatorRecord = getIndicatorRecordFromFile(indicatorFileContent)
    let autopilotResponse = await getAutopilot()

    if (indicatorRecord === undefined) {
      if (LOG_INFO === true) { logger.write(MODULE_NAME, '[INFO] start -> Indicator record not found.') }

      let plotterData = createPlotterData("NoIndicator", "NO_SIGNAL", autopilotResponse.autopilot, 0, 0, 0)
      assistant.addExtraData(plotterData)

      return callBackFunction(global.DEFAULT_OK_RESPONSE)
    }

    if (LOG_INFO === true) { logger.write(MODULE_NAME, '[INFO] start -> Processing indicator record:' + JSON.stringify(indicatorRecord)) }

    // Checking Stop Loss
    let assetABalance = assistant.getAvailableBalance().assetA
    let currentRate = assistant.getMarketRate()

    if (assetABalance > 0 && currentRate >= indicatorRecord.stopLoss) {
      if (LOG_INFO === true) { logger.write(MODULE_NAME, '[INFO] manageTradeStopLoss -> Closing trade with Stop Loss.') }
      await createBuyPosition(currentRate)

      let plotterData = createPlotterData("StopLoss", "NO_SIGNAL", autopilotResponse.autopilot, assetABalance, currentRate, 0)
      assistant.addExtraData(plotterData)

      return callBackFunction(global.DEFAULT_OK_RESPONSE)
    }

    if (autopilotResponse.autopilot) {
      await manageCloneInAutopilotOn(callBackFunction)
    } else {
      await manageCloneInAutopilotOff(callBackFunction)
    }
  }

  async function manageCloneInAutopilotOn(callBackFunction) {
    let assetABalance = assistant.getAvailableBalance().assetA
    let assetBBalance = assistant.getAvailableBalance().assetB
    if (indicatorRecord.type === "Sell") {
      await createSellPosition(indicatorRecord)

      let plotterData = createPlotterData("Sell", "NO_SIGNAL", true, assetABalance, 0, 0)
      assistant.addExtraData(plotterData)
      return callBackFunction(global.DEFAULT_OK_RESPONSE)
    } else if (assetBBalance > 0) {
      await createBuyPosition(indicatorRecord.buyOrder)

      let plotterData = createPlotterData("Buy", "NO_SIGNAL", true, assetBBalance, 0, 0)
      assistant.addExtraData(plotterData)
      return callBackFunction(global.DEFAULT_OK_RESPONSE)
    } else {
      if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] start -> businessLogic -> indicatorSignal -> Nothing to do, there isn't a buy or sell opportunity.") }
    }
  }

  async function manageCloneInAutopilotOff(callBackFunction) {
    // If there is any signal not yet approved we update with the new indicator value
    let assetABalance = assistant.getAvailableBalance().assetA
    let autopilot = false
    let signals = await getSignalsByCloneId("SIGNALED")
    if (signals !== undefined && signals.length > 0) {
      for (let inProcessSignal of signals) {
        let cockpitData = createCockpitData(indicatorRecord)
        await updateSignal(inProcessSignal.id, "SIGNALED", "Updating with the information from the market.", cockpitData)

        let plotterData = createPlotterData("Sell", "SIGNALED", autopilot, assetABalance, cockpitData.stopLoss, cockpitData.buyOrder)
        assistant.addExtraData(plotterData)
      }
      return callBackFunction(global.DEFAULT_OK_RESPONSE)
    }

    // If there is an accepted signal we will proceed to execute it on the market
    let acceptedSignals = await getSignalsByCloneId("ACCEPTED")
    if (acceptedSignals !== undefined && acceptedSignals.length > 0) {
      for (let acceptedSignal of acceptedSignals) {
        let marketOrderResult = await createSellPosition(acceptedSignal.orderData)
        if (!marketOrderResult.error) {
          await updateSignal(acceptedSignal.id, "IN_PROCESS", "Order was placed in the market.", acceptedSignal.orderData)

          let plotterData = createPlotterData("Sell", "IN_PROCESS", autopilot, acceptedSignal.orderData.amount, acceptedSignal.orderData.stopLoss, acceptedSignal.orderData.buyOrder)
          assistant.addExtraData(plotterData)
        } else {
          await updateSignal(acceptedSignal.id, "FAILED", "Failed to put the order on the exchange: " + marketOrderResult.error, acceptedSignal.orderData)

          let plotterData = createPlotterData("Sell", "FAILED", autopilot, acceptedSignal.orderData.amount, acceptedSignal.orderData.stopLoss, acceptedSignal.orderData.buyOrder)
          assistant.addExtraData(plotterData)
        }
      }

      return callBackFunction(global.DEFAULT_OK_RESPONSE)
    }

    // If there is an in process signal we will proceed to execute it on the market
    let inProcessSignals = await getSignalsByCloneId("IN_PROCESS")
    if (inProcessSignals !== undefined && inProcessSignals.length > 0) {
      for (let inProcessSignal of inProcessSignals) {
        if (checkSignalCompletion()) {
          await updateSignal(inProcessSignal.id, "PROCESSED", "The order was executed on the market.", inProcessSignal.orderData)

          let plotterData = createPlotterData("Sell", "PROCESSED", autopilot, inProcessSignal.orderData.amount, inProcessSignal.orderData.stopLoss, inProcessSignal.orderData.buyOrder)
          assistant.addExtraData(plotterData)
        }
      }
      return callBackFunction(global.DEFAULT_OK_RESPONSE)
    }

    // Finally we check if it's needed to create a new signal
    if (indicatorRecord.type === "Sell") {
      if (LOG_INFO === true) { logger.write(MODULE_NAME, '[INFO] createNewSignal -> SELLING') }

      let assetBBalance = assistant.getAvailableBalance().assetB
      let context = createContextData(indicatorRecord)
      let cockpitData = createCockpitData(indicatorRecord, assetBBalance)
      await createSignal(context, cockpitData)

      let plotterData = createPlotterData("Sell", "SIGNALED", autopilot, assetBBalance, cockpitData.stopLoss, cockpitData.buyOrder)
      assistant.addExtraData(plotterData)

      return callBackFunction(global.DEFAULT_OK_RESPONSE)
    } else {
      if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] createNewSignal -> Nothing to do, there isn't a buy or sell opportunity.") }
      return
    }

    if (LOG_INFO === true) { logger.write(MODULE_NAME, "[WARN] manageSignals -> Any condition was reached while cockpit interation is enabled.") }
    return callBackFunction(global.DEFAULT_OK_RESPONSE)
  }

  function createBuyPosition(currentRate) {
    try {
      let amountA = assistant.getAvailableBalance().assetA
      let amountB = Number((amountA / currentRate).toFixed(8))

      if (amountA > 0) {
        if (LOG_INFO === true) { logger.write(MODULE_NAME, '[INFO] createBuyPosition -> Put a new BUY position at price: $' + Number(currentRate).toLocaleString()) }

        return new Promise(
          function (resolve, reject) {
            assistant.putPosition('buy', currentRate, amountA, amountB, (result) => {
              if (result !== global.DEFAULT_OK_RESPONSE) {
                reject(result)
              } else {
                resolve(global.DEFAULT_OK_RESPONSE)
              }
            })
          }
        )
      } else {
        if (LOG_INFO === true) { logger.write(MODULE_NAME, '[INFO] createBuyPosition -> Not enough available balance to buy.') }
      }
    } catch (error) {
      logger.write(MODULE_NAME, '[ERROR] createBuyPosition -> err = ' + error.message)
      throw error
    }
  }

  function createSellPosition(indicatorRecord) {
    try {
      let assetBBalance = assistant.getAvailableBalance().assetB
      let currentRate = indicatorRecord.rate
      let amountB = assistant.getAvailableBalance().assetB
      let amountA = amountB * currentRate

      if (assetBBalance > 0) {
        if (LOG_INFO === true) { logger.write(MODULE_NAME, '[INFO] createSellPosition -> Put a new SELL position at price: $' + Number(currentRate).toLocaleString()) }

        return new Promise(
          function (resolve, reject) {
            assistant.putPosition('sell', currentRate, amountA, amountB, (result) => {
              if (result !== global.DEFAULT_OK_RESPONSE) {
                reject(result)
              } else {
                resolve(global.DEFAULT_OK_RESPONSE)
              }
            })
          }
        )
      } else {
        if (LOG_INFO === true) { logger.write(MODULE_NAME, '[INFO] createSellPosition -> There is not enough available balance to sell.') }
      }
    } catch (error) {
      logger.write(MODULE_NAME, '[ERROR] createSellPosition -> error = ' + error.message)
      throw error
    }
  }

  function checkSignalCompletion() {
    let positions = assistant.getPositions()
    if ((positions.length === 0) || (positions.length > 0 && positions[0].status === 'executed')) {
      if (LOG_INFO === true) { logger.write(MODULE_NAME, '[INFO] checkSignalCompletion -> The order was executed.') }
      return true
    } else {
      return false
    }
  }

  // Storage functions
  async function getIndicatorFile() {
    if (LOG_INFO === true) { logger.write(MODULE_NAME, '[INFO] getIndicatorFile -> Entering function.') }

    let filePath = 'Trading-Simulation/' + bot.dataSet + '/' + bot.timePeriodFileStorage

    /*
      bot.botCache: allows us to keep a map (key value pairs) between executions,
        so we don't need to go to the storage to retrieve this value.
      If the value already exist on the cache we will get it from there,
      otherwise it will be retrieved from the bot storage.
    */
    if (bot.startMode === 'Backtest' && bot.botCache.has(filePath)) {
      if (FULL_LOG === true) { logger.write(MODULE_NAME, '[INFO] getIndicatorFile -> Getting the file from local cache.') }
      return bot.botCache.get(filePath)
    } else {
      let response = getFileContent(filePath, 'USDT_BTC.json')
      let indicatorFileContent = await response
      bot.botCache.set(filePath, JSON.parse(indicatorFileContent))
      return indicatorFileContent
    }
  }

  function getIndicatorRecordFromFile(indicatorFileContent) {
    try {
      let lastIndexIndicatorFile = indicatorFileContent.length - 1
      let lastAvailableDateTime = indicatorFileContent[lastIndexIndicatorFile][0]

      if (bot.processDatetime.valueOf() <= lastAvailableDateTime || !isExecutionToday()) {
        for (let i = 0; i < indicatorFileContent.length; i++) {
          if (bot.processDatetime.valueOf() >= indicatorFileContent[i][0] && bot.processDatetime.valueOf() < indicatorFileContent[i][1]) {
            indicatorRecord = {
              begin: indicatorFileContent[i][0],
              end: indicatorFileContent[i][1],
              type: indicatorFileContent[i][2],
              rate: indicatorFileContent[i][3],
              amount: indicatorFileContent[i][4],
              balanceA: indicatorFileContent[i][5],
              balanceB: indicatorFileContent[i][6],
              profit: indicatorFileContent[i][7],
              lastProfit: indicatorFileContent[i][8],
              stopLoss: indicatorFileContent[i][9],
              roundtrips: indicatorFileContent[i][10],
              hits: indicatorFileContent[i][11],
              fails: indicatorFileContent[i][12],
              hitRatio: indicatorFileContent[i][13],
              ROI: indicatorFileContent[i][14],
              periods: indicatorFileContent[i][15],
              days: indicatorFileContent[i][16],
              anualizedRateOfReturn: indicatorFileContent[i][17],
              sellRate: indicatorFileContent[i][18],
              lastProfitPercent: indicatorFileContent[i][19],
              strategy: indicatorFileContent[i][20],
              strategyPhase: indicatorFileContent[i][21],
              buyOrder: indicatorFileContent[i][22],
              stopLossPhase: indicatorFileContent[i][23],
              buyOrderPhase: indicatorFileContent[i][24]
            }

            return indicatorRecord
          }
        }

        logger.write(MODULE_NAME, '[WARN] getIndicatorRecordFromFile -> The expected Indicator Record was not found: ' + bot.processDatetime.valueOf())
        return
      } else {
        // Running live we will process last available Indicator Record only if it's delayed 25 minutes top
        let maxTolerance = 25 * 60 * 1000
        if (bot.processDatetime.valueOf() <= (lastAvailableDateTime + maxTolerance)) {
          indicatorRecord = {
            begin: indicatorFileContent[lastIndexIndicatorFile][0],
            end: indicatorFileContent[lastIndexIndicatorFile][1],
            type: indicatorFileContent[lastIndexIndicatorFile][2],
            rate: indicatorFileContent[lastIndexIndicatorFile][3],
            amount: indicatorFileContent[lastIndexIndicatorFile][4],
            balanceA: indicatorFileContent[lastIndexIndicatorFile][5],
            balanceB: indicatorFileContent[lastIndexIndicatorFile][6],
            profit: indicatorFileContent[lastIndexIndicatorFile][7],
            lastProfit: indicatorFileContent[lastIndexIndicatorFile][8],
            stopLoss: indicatorFileContent[lastIndexIndicatorFile][9],
            roundtrips: indicatorFileContent[lastIndexIndicatorFile][10],
            hits: indicatorFileContent[lastIndexIndicatorFile][11],
            fails: indicatorFileContent[lastIndexIndicatorFile][12],
            hitRatio: indicatorFileContent[lastIndexIndicatorFile][13],
            ROI: indicatorFileContent[lastIndexIndicatorFile][14],
            periods: indicatorFileContent[lastIndexIndicatorFile][15],
            days: indicatorFileContent[lastIndexIndicatorFile][16],
            anualizedRateOfReturn: indicatorFileContent[lastIndexIndicatorFile][17],
            sellRate: indicatorFileContent[lastIndexIndicatorFile][18],
            lastProfitPercent: indicatorFileContent[lastIndexIndicatorFile][19],
            strategy: indicatorFileContent[lastIndexIndicatorFile][20],
            strategyPhase: indicatorFileContent[lastIndexIndicatorFile][21],
            buyOrder: indicatorFileContent[lastIndexIndicatorFile][22],
            stopLossPhase: indicatorFileContent[lastIndexIndicatorFile][23],
            buyOrderPhase: indicatorFileContent[lastIndexIndicatorFile][24]
          }

          return indicatorRecord

        } else {
          if (LOG_INFO === true) logger.write(MODULE_NAME, '[WARN]  getIndicatorRecordFromFile -> Available candle older than 25 minutes. Skipping execution.')
          return
        }
      }
    } catch (error) {
      logger.write(MODULE_NAME, '[ERROR] getIndicatorRecordFromFile -> error = ' + error.message)
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
        if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] getSignalsByCloneId -> Ok.") }
        return cockPit.data.data.cockpit_SignalsByCloneId
      }

    } catch (error) {
      logger.write(MODULE_NAME, "[ERROR] getSignalsByCloneId error: " + error)
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
        if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] updateSignal -> Ok.") }
        return cockPit.data.data.cockpit_UpdateSignal
      }
    } catch (error) {
      logger.write(MODULE_NAME, "[ERROR] updateSignal error: " + error)
      throw error
    }
  }

  async function createSignal(context, orderData) {
    try {
      const cockPit = await axios({
        url: process.env.GATEWAY_ENDPOINT,
        method: 'post',
        data: {
          query: `
            mutation ($state: cockpit_SignalStateEnum!, $cloneId: String!,
                $context: cockpit_JSON,  $orderData:cockpit_JSON, ){
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
            context: context,
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
        if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] createSignal -> Ok.") }
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
        if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] getAutopilot -> Ok.") }
        return cockPit.data.data.cockpit_CloneSettingsByCloneId
      }

    } catch (error) {
      if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] getAutopilot error: " + error) }
      throw error
    }
  }

  function getFileContent(containerName, blobName) {
    return new Promise(
      function (resolve, reject) {
        fileStorage.getTextFile(containerName, blobName, (result, fileContent) => {
          if (result !== global.DEFAULT_OK_RESPONSE) {
            reject(result)
          } else {
            resolve(fileContent)
          }
        })
      }
    )
  }

  function createCockpitData(indicatorRecord, amount) {
    let cockpitData = {
      dateTime: indicatorRecord.begin,
      rate: indicatorRecord.rate,
      stopLoss: indicatorRecord.stopLoss,
      buyOrder: indicatorRecord.buyOrder
    }

    if (amount) {
      cockpitData.type = indicatorRecord.type,
        cockpitData.amount = amount
    }

    return cockpitData
  }

  function createContextData(indicatorRecord) {
    let contextData = {
      strategyUsed: indicatorRecord.strategy
    }

    return contextData
  }

  function createPlotterData(positionType, signalState, autopilot, positionAmount, stopLoss, buyOrder) {
    let plotterData = [
      positionType,
      signalState,
      autopilot,
      positionAmount,
      stopLoss,
      buyOrder
    ]

    return plotterData
  }

}
