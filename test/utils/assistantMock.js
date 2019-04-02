var bot = require("../../this.bot.config.json")

exports.newAssistantMock = function newAssistantMock() {

    var extraData = []
    var positions = []
    var fileRecords = []
    var fileNotFound = false
    var marketRate = 4000
    var availableBalance = {
        assetA: 0,
        assetB: 1
    }
    return {
        dataDependencies: getDataDependencies(),
        putPosition: putPosition,
        getPositions: getPositions,
        getAvailableBalance: getAvailableBalance,
        setAvailableBalance: setAvailableBalance,
        getMarketRate: getMarketRate,
        setMarketRate: setMarketRate,
        addExtraData: addExtraData,
        getExtraData: getExtraData,
        executePositions: executePositions,
        setFileRecords: setFileRecords,
        setFileNotFound: setFileNotFound
    }

    function setFileRecords(records) {
        fileRecords = records
    }
    function setFileNotFound(value) {
        fileNotFound = value
    }

    function getDataDependencies() {
        let map = new Map()
        let key = bot.devTeam + '-simulator-' + bot.codeName + '-Trading-Simulation-' + bot.dataSet + '-dataSet.V1'
        let storage = {
            getTextFile: (pFolderPath, pFileName, callBackFunction) => {
                if (fileNotFound) {
                    callBackFunction(global.DEFAULT_FAIL_RESPONSE, "File not found.")
                } else {
                    callBackFunction(global.DEFAULT_OK_RESPONSE, JSON.stringify(fileRecords))
                }
            }
        }
        map.set(key, storage)
        return {
            dataSets: map
        }
    }

    function getAvailableBalance() {
        return availableBalance
    }
    function setAvailableBalance(balances) {
        availableBalance = balances
    }

    function getMarketRate() {
        return marketRate
    }

    function setMarketRate(rate) {
        marketRate = rate
    }

    function addExtraData(record) {
        extraData.push(record)
    }

    function getExtraData() {
        return extraData
    }

    function putPosition(pType, pRate, pAmountA, pAmountB, callBackFunction) {
        let position = {
            id: Math.trunc(Math.random(1) * 1000000),
            type: pType,
            rate: pRate,
            amountA: pAmountA,
            amountB: pAmountB,
            date: (new Date()).valueOf(),
            status: "open",
            trades: []
        };
        positions.push(position)
        callBackFunction(global.DEFAULT_OK_RESPONSE, position)
    }

    function executePositions() {
        for (let index = 0; index < positions.length; index++) {
            const position = positions[index];
            position.status = "executed"
        }
    }

    function getPositions() {
        return positions
    }
}
