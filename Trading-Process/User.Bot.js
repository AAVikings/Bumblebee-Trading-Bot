exports.newUserBot = function newUserBot(bot, logger) {
  /*
    Creating a new instance from the platform of this bot:
    - bot: An instance of the bot configuration
    - logger: An instance of the platform logger that allows both: to save logs
        on cloud execution and shows logs on the browser console on browser execution
  */

  // Variable used for logs, which will be passed to the logger instance
  const MODULE_NAME = 'User Bot'
  // Debug log level
  const FULL_LOG = true
  // Info log level
  const LOG_INFO = true

  /*
    The reference to the Trading Platform Advanced Algos Assistant that will
    allow to:
        dataDependencies: Retrieve all dependencies to other bots defined on the configuration
        putPosition: Put a buy or sell position at the exchange (only limit orders at this point)
        movePosition: Move an existing position
        getPositions: Obtain all the positions existing on the exchange
        getBalance: Obtain the total balance on the exchange known by the platform (at this point 0.001 BTC)
        getAvailableBalance: Obtain the current available balance on the exchange known by the platform
        getInvestment: Obtain initial investment known by the platform (at this point 0.001 BTC)
        getProfits: Get current profits at this point in time
        getCombinedProfits: Get current profits
        getROI: Get current ROI
        getMarketRate: Get current market rate
        getTicker: Gets the current highest bid and lowest ask on the exchange
        sendMessage: Put a visual message on the platform (different zoom levels [1-10] can be handled)
        rememberThis: Store a string variable across executions by key value pairs
        remindMeOf: Get a stored string value by key
        sendEmail: Send an email during execution as notifications
  */
  let assistant

  /*
    This is a dependency example to other bots, in this case to the the
    LRC Indicator.
  */
  let simulatorStorage

  let timePeriod, dataSet

  /*
    This objects returns two public functions that will be used to integrate
    with the platform.
  */
  let thisObject = {
    initialize: initialize,
    start: start
  }
  return thisObject

  /*
    The initialize function must be implemented by all trading bots.
      pAssistant: the instance of the platform which methods will allow to put getPositions
      pGenes: This variable will be used during initialization to get the parameters
        from the platform. At the moment it is not used but in future releases
        it will allow to create different clones of the Algobot, to form an Algonet.
  */
  function initialize(pAssistant, pGenes, callBackFunction) {
    try {
      if (LOG_INFO === true) { logger.write(MODULE_NAME, '[INFO] initialize -> Entering function.') }

      // Integration with platform logger, when running on cloud
      logger.fileName = MODULE_NAME

      /*
        We keep a local reference to the assistant that allows to put
        positions on the exchange, created and managed by the platform
      */
      assistant = pAssistant

      /*
        On 'assistant.dataDependencies.dataSets' we will receive the data files
        retrieved for those defined on the bot configuration.
        Note that the key is:
          TeamName-BotName-BotProductFolder-BotProcessName-BotDataSetVersion

        In this case, this particular bot will use Gauss indicator; other
        indicators are available. You can use any indicator you want,
        or create a new one if you should need to.
      */

      let key = bot.devTeam + '-simulator-' + bot.codeName + '-Trading-Simulation-Multi-Period-Market-dataSet.V1'
      simulatorStorage = assistant.dataDependencies.dataSets.get(key)

      let executionParameters = JSON.parse(process.env.EXECUTION_PARAMETERS)
      timePeriod = executionParameters.timePeriod
      if (timePeriod === undefined) {
        throw new Error("Execution Parameter Time Period not defined.")
      }

      dataSet = executionParameters.dataSet
      if (dataSet === undefined) {
        throw new Error("Execution Parameter Data Set not defined.")
      }

      /*
        Once Completed we must return the global.DEFAULT_OK_RESPONSE
      */
      callBackFunction(global.DEFAULT_OK_RESPONSE)

    } catch (err) {
      logger.write(MODULE_NAME, '[ERROR] initialize -> onDone -> err = ' + err.message)
      callBackFunction(global.DEFAULT_FAIL_RESPONSE)
    }
  }

  /*
    The start function is called by the platform for executing the bot every 1 minute
  */
  function start(callBackFunction) {
    if (LOG_INFO === true) { logger.write(MODULE_NAME, '[INFO] start -> Entering function.') }

    /*
      Here we call the main function that will check buy, sell or move conditions.
    */
    businessLogic(onDone)

    /*
      This function will be called after we complete all validations and operations,
      we make sure everything was ok before returning the control to the platform.
        The platform will check this 3 situations:
          global.DEFAULT_OK_RESPONSE: Proceed with normal execution
          global.DEFAULT_RETRY_RESPONSE: Retry after 10 seconds
          global.DEFAULT_FAIL_RESPONSE: Finish in failure state
            (this allows us to check the logs and fix execution errors when they occur)
    */
    function onDone(err) {
      try {
        switch (err.result) {
          case global.DEFAULT_OK_RESPONSE.result: {
            logger.write(MODULE_NAME, '[INFO] start -> onDone -> Execution finished well. :-)')
            callBackFunction(global.DEFAULT_OK_RESPONSE)
            return
          }
          case global.DEFAULT_RETRY_RESPONSE.result: {  // Something bad happened, but if we retry in a while it might go through the next time.
            logger.write(MODULE_NAME, '[ERROR] start -> onDone -> Retry Later. Requesting Execution Retry.')
            callBackFunction(global.DEFAULT_RETRY_RESPONSE)
            return
          }
          case global.DEFAULT_FAIL_RESPONSE.result: { // This is an unexpected exception that we do not know how to handle.
            logger.write(MODULE_NAME, '[ERROR] start -> onDone -> Operation Failed. Aborting the process. err = ' + err.message)
            callBackFunction(global.DEFAULT_FAIL_RESPONSE)
            return
          }
        }
      } catch (err) {
        logger.write(MODULE_NAME, '[ERROR] start -> onDone -> err = ' + err.message)
        callBackFunction(global.DEFAULT_FAIL_RESPONSE)
      }
    }

    /*
      We will check the direction of the channel and based on that create a buy or sell
      position in the market.
      Here is a detailed explanation of the bot:
        https://github.com/AAVikings/AAArtudito-Trading-Bot/blob/master/README.md
    */
    function businessLogic(callBack) {
      if (LOG_INFO === true) { logger.write(MODULE_NAME, '[INFO] start -> businessLogic -> Entering function.') }

      // Simulation for forcing buy or sell on each execution without checking the rules
      let forceBuyAndSell = false
      if (forceBuyAndSell) {
        if (Math.random(1) <= 0.5) {
          createBuyPosition(callBack);
        } else {
          createSellPosition(callBack);
        }
      } else {
        getIndicatorSignal(indicatorSignal);
      }

      function indicatorSignal(err, indicatorRecord) {
        try {

          if (LOG_INFO === true) { logger.write(MODULE_NAME, '[INFO] start -> businessLogic -> indicatorSignal  -> Entering Function.') }

          if (indicatorRecord === undefined) {
            if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] start -> businessLogic -> indicatorSignal -> Nothing to do, there isn't a buy or sell opportunity.") }
            callBack(global.DEFAULT_OK_RESPONSE)
          }

          if (err.result !== global.DEFAULT_OK_RESPONSE.result) {
            logger.write(MODULE_NAME, '[ERROR] start -> businessLogic -> indicatorSignal -> err = ' + err.message)
            callBack(global.DEFAULT_FAIL_RESPONSE)
          } else {
            if (LOG_INFO === true) { logger.write(MODULE_NAME, '[INFO] start -> businessLogic -> Indicator Record:' + JSON.stringify(indicatorRecord)) }

            let assetBBalance = assistant.getAvailableBalance().assetB
            if (indicatorRecord.type === "Sell") {
              createSellPosition(callBack)
            } else if (assetBBalance > 0) {
              //Stop loss configuration
              let closeTrade = checkToCloseTradeWithStopLoss()
              if (closeTrade) {
                createBuyPosition(callBack)
              } else {
                createBuyPosition(callBack, indicatorRecord.buyOrder)
              }
            } else {
              if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] start -> businessLogic -> indicatorSignal -> Nothing to do, there isn't a buy or sell opportunity.") }
              callBack(global.DEFAULT_OK_RESPONSE)
            }
          }
        } catch (err) {
          logger.write(MODULE_NAME, '[ERROR] start -> businessLogic -> indicatorSignal -> err = ' + err.message)
          callBackFunction(global.DEFAULT_FAIL_RESPONSE)
        }
      }
    }

    function getIndicatorFile(callback) {
      if (LOG_INFO === true) { logger.write(MODULE_NAME, '[INFO] start -> getIndicatorFile -> Entering function.') }

      let filePath = 'Trading-Simulation/' + dataSet + '/' + timePeriod
      let fileName = 'USDT_BTC.json'

      /*
        bot.botCache: allows us to keep a map (key value pairs) between executions,
          so we don't need to go to the storage to retrieve this value.
        If the value already exist on the cache we will get it from there,
        otherwise it will be retrieved from the bot storage.
      */
      if (bot.startMode === 'Backtest' && bot.botCache.has(filePath)) {
        if (FULL_LOG === true) { logger.write(MODULE_NAME, '[INFO] start -> getIndicatorFile -> Getting the file from local cache.') }

        callback(global.DEFAULT_OK_RESPONSE, bot.botCache.get(filePath))
      } else {
        simulatorStorage.getTextFile(filePath, fileName, onFileReceived)
      }

      function onFileReceived(err, text) {
        if (err.result === global.DEFAULT_OK_RESPONSE.result) {
          if (FULL_LOG === true) { logger.write(MODULE_NAME, '[INFO] start -> getIndicatorFile -> onFileReceived > Entering Function.') }

          let indicatorFileContent = JSON.parse(text)
          bot.botCache.set(filePath, indicatorFileContent)
          callback(global.DEFAULT_OK_RESPONSE, indicatorFileContent)
        } else {
          logger.write(MODULE_NAME, '[ERROR] start -> getIndicatorFile -> onFileReceived -> Failed to get the file. Will abort the process and request a retry.')
          callBackFunction(global.DEFAULT_RETRY_RESPONSE)
        }
      }
    }

    function getIndicatorSignal(callBack) {
      if (LOG_INFO === true) { logger.write(MODULE_NAME, '[INFO] start -> businessLogic -> getIndicatorSignal -> Entering function.') }

      let indicatorRecord
      getIndicatorFile(onIndicatorFileReceived)

      function onIndicatorFileReceived(err, indicatorFile) {

        if (err.result !== global.DEFAULT_OK_RESPONSE.result) {
          callBack(err)
        }

        try {
          if (LOG_INFO === true) { logger.write(MODULE_NAME, '[INFO] start -> businessLogic -> getIndicatorSignal -> onIndicatorFileReceived.') }

          let lastIndexIndicatorFile = indicatorFile.length - 1
          let lastAvailableDateTime = indicatorFile[lastIndexIndicatorFile][0]

          if (bot.processDatetime.valueOf() <= lastAvailableDateTime || !isExecutionToday()) {
            for (let i = 0; i < indicatorFile.length; i++) {
              if (bot.processDatetime.valueOf() >= indicatorFile[i][0] && bot.processDatetime.valueOf() < indicatorFile[i][1]) {
                indicatorRecord = {
                  begin: indicatorFile[i][0],
                  end: indicatorFile[i][1],
                  type: indicatorFile[i][2],
                  rate: indicatorFile[i][3],
                  amount: indicatorFile[i][4],
                  balanceA: indicatorFile[i][5],
                  balanceB: indicatorFile[i][6],
                  profit: indicatorFile[i][7],
                  lastProfit: indicatorFile[i][8],
                  stopLoss: indicatorFile[i][9],
                  roundtrips: indicatorFile[i][10],
                  hits: indicatorFile[i][11],
                  fails: indicatorFile[i][12],
                  hitRatio: indicatorFile[i][13],
                  ROI: indicatorFile[i][14],
                  periods: indicatorFile[i][15],
                  days: indicatorFile[i][16],
                  anualizedRateOfReturn: indicatorFile[i][17],
                  sellRate: indicatorFile[i][18],
                  lastProfitPercent: indicatorFile[i][19],
                  strategy: indicatorFile[i][20],
                  strategyPhase: indicatorFile[i][21],
                  buyOrder: indicatorFile[i][22],
                  stopLossPhase: indicatorFile[i][23],
                  buyOrderPhase: indicatorFile[i][24]
                }

                callBack(global.DEFAULT_OK_RESPONSE, indicatorRecord)
                return
              }
            }

            logger.write(MODULE_NAME, '[WARN] start -> businessLogic -> getIndicatorSignal -> onIndicatorFileReceived. The expected Indicator Record was not found: ' + bot.processDatetime.valueOf())
            callBack(global.DEFAULT_OK_RESPONSE)
          } else {
            // Running live we will process last available Indicator Record only if it's delayed 25 minutes top
            let maxTolerance = 25 * 60 * 1000
            if (bot.processDatetime.valueOf() <= (lastAvailableDateTime + maxTolerance)) {
              indicatorRecord = {
                begin: indicatorFile[lastIndexIndicatorFile][0],
                end: indicatorFile[lastIndexIndicatorFile][1],
                type: indicatorFile[lastIndexIndicatorFile][2],
                rate: indicatorFile[lastIndexIndicatorFile][3],
                amount: indicatorFile[lastIndexIndicatorFile][4],
                balanceA: indicatorFile[lastIndexIndicatorFile][5],
                balanceB: indicatorFile[lastIndexIndicatorFile][6],
                profit: indicatorFile[lastIndexIndicatorFile][7],
                lastProfit: indicatorFile[lastIndexIndicatorFile][8],
                stopLoss: indicatorFile[lastIndexIndicatorFile][9],
                roundtrips: indicatorFile[lastIndexIndicatorFile][10],
                hits: indicatorFile[lastIndexIndicatorFile][11],
                fails: indicatorFile[lastIndexIndicatorFile][12],
                hitRatio: indicatorFile[lastIndexIndicatorFile][13],
                ROI: indicatorFile[lastIndexIndicatorFile][14],
                periods: indicatorFile[lastIndexIndicatorFile][15],
                days: indicatorFile[lastIndexIndicatorFile][16],
                anualizedRateOfReturn: indicatorFile[lastIndexIndicatorFile][17],
                sellRate: indicatorFile[lastIndexIndicatorFile][18],
                lastProfitPercent: indicatorFile[lastIndexIndicatorFile][19],
                strategy: indicatorFile[lastIndexIndicatorFile][20],
                strategyPhase: indicatorFile[lastIndexIndicatorFile][21],
                buyOrder: indicatorFile[lastIndexIndicatorFile][22],
                stopLossPhase: indicatorFile[lastIndexIndicatorFile][23],
                buyOrderPhase: indicatorFile[lastIndexIndicatorFile][24]
              }

              callBack(global.DEFAULT_OK_RESPONSE, indicatorRecord)
              return

            } else {
              if (LOG_INFO === true) logger.write(MODULE_NAME, '[WARN] start -> getIndicatorSignal -> onIndicatorFileReceived. Available candle older than 25 minutes. Skipping execution.')

              callBack(global.DEFAULT_OK_RESPONSE)
              return
            }
          }
        } catch (err) {
          logger.write(MODULE_NAME, '[ERROR] start -> getIndicatorSignal -> onIndicatorFileReceived -> err = ' + err.message)
          callBackFunction(global.DEFAULT_FAIL_RESPONSE)
        }
      }
    }

    function createBuyPosition(callBack, currentRate) {
      try {
        if (LOG_INFO === true) { logger.write(MODULE_NAME, '[INFO] start -> businessLogic -> createBuyPosition -> Entering function.') }

        // We get the current positions we have at the exchange
        let positions = assistant.getPositions()
        if (!currentRate) {
          currentRate = assistant.getTicker().ask
        }
        let amountA = assistant.getAvailableBalance().assetA
        let amountB = Number((amountA / currentRate).toFixed(8))

        if (positions.length > 0 && positions[0].type === 'buy' && positions[0].status !== 'executed') {
          if (LOG_INFO === true) { logger.write(MODULE_NAME, '[INFO] start -> businessLogic -> createBuyPosition -> Moving an existing BUY position to a new price: $' + Number(currentRate).toLocaleString()) }

          let message = 'Moving an existing buy position to a new price: $' + Number(currentRate).toLocaleString()
          message += '. Combined ROI on current execution: ' + getCombinedProfit() + '%. '
          assistant.sendMessage(6, 'Moving Position', message)
          message = bot.processDatetime.toISOString() + ' - ' + message
          assistant.movePosition(positions[0], currentRate, callBack)
        } else if (amountA > 0) {
          if (LOG_INFO === true) { logger.write(MODULE_NAME, '[INFO] start -> businessLogic -> createBuyPosition -> bumblebee put a new BUY position at price: $' + Number(currentRate).toLocaleString()) }

          let message = 'Creating a new buy position. Price: $' + Number(currentRate).toLocaleString()
          message += '. Combined ROI on current execution: ' + getCombinedProfit() + '%. '
          assistant.sendMessage(7, 'Buying', message)
          message = bot.processDatetime.toISOString() + ' - ' + message
          assistant.putPosition('buy', currentRate, amountA, amountB, callBack)
        } else {
          if (LOG_INFO === true) { logger.write(MODULE_NAME, '[INFO] start -> businessLogic -> createBuyPosition -> Not enough available balance to buy.') }

          callBack(global.DEFAULT_OK_RESPONSE)
        }
      } catch (err) {
        logger.write(MODULE_NAME, '[ERROR] start -> businessLogic -> createBuyPosition -> err = ' + err.message)
        callBackFunction(global.DEFAULT_FAIL_RESPONSE)
      }
    }

    function createSellPosition(callBack) {
      try {
        if (LOG_INFO === true) { logger.write(MODULE_NAME, '[INFO] start -> businessLogic -> createSellPosition -> Entering function.') }

        // We get the current positions we have at the exchange
        let positions = assistant.getPositions()
        let assetBBalance = assistant.getAvailableBalance().assetB
        let currentRate = assistant.getTicker().bid
        let amountB = assistant.getAvailableBalance().assetB
        let amountA = amountB * currentRate

        if (positions.length > 0 && positions[0].type === 'sell' && positions[0].status !== 'executed') {
          if (LOG_INFO === true) { logger.write(MODULE_NAME, '[INFO] start -> businessLogic -> createSellPosition -> bumblebee is moving an existing SELL position to a new price: $' + Number(currentRate).toLocaleString()) }

          let message = 'Moving an existing sell position to a new price: $' + Number(currentRate).toLocaleString()
          message += '. Combined ROI on current execution: ' + getCombinedProfit() + '%. '
          assistant.sendMessage(6, 'Moving Position', message)
          message = bot.processDatetime.toISOString() + ' - ' + message
          assistant.movePosition(positions[0], currentRate, callBack)
        } else if (assetBBalance > 0) {
          if (LOG_INFO === true) { logger.write(MODULE_NAME, '[INFO] start -> businessLogic -> createSellPosition -> bumblebee put a new SELL position at price: $' + Number(currentRate).toLocaleString()) }

          let message = 'Creating a new sell position. Price: $' + Number(currentRate).toLocaleString()
          message += '. Combined ROI on current execution: ' + getCombinedProfit() + '%. '
          assistant.sendMessage(7, 'Selling', message)
          message = bot.processDatetime.toISOString() + ' - ' + message
          assistant.putPosition('sell', currentRate, amountA, amountB, callBack)
        } else {
          if (LOG_INFO === true) { logger.write(MODULE_NAME, '[INFO] start -> businessLogic -> createSellPosition -> There is not enough available balance to sell.') }

          callBack(global.DEFAULT_OK_RESPONSE)
        }
      } catch (err) {
        logger.write(MODULE_NAME, '[ERROR] start -> businessLogic -> createBuyPosition -> err = ' + err.message)
        callBackFunction(global.DEFAULT_FAIL_RESPONSE)
      }
    }

    function checkToCloseTradeWithStopLoss(stopLossValue) {
      let assetABalance = assistant.getAvailableBalance().assetA
      let currentRate = assistant.getMarketRate()

      if (assetABalance > 0 && currentRate >= stopLossValue) {
        if (LOG_INFO === true) { logger.write(MODULE_NAME, '[INFO] start -> checkToCloseTradeWithStopLoss -> Closing trade with Stop Loss.') }

        return true
      } else {
        return false
      }
    }

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

    function getCombinedProfit() {
      if (assistant.getCombinedProfits() !== undefined) {
        if (assistant.getCombinedProfits().assetA > 0) {
          return Number(assistant.getCombinedProfits().assetA).toLocaleString()
        } else {
          return Number(assistant.getCombinedProfits().assetB).toLocaleString()
        }
      }
    }
  }
}
