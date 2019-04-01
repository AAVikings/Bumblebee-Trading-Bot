var bot = require("../../this.bot.config.json")

exports.newAssistantMock = function newAssistantMock() {

    var extraData = []
    var positions = []
    var fileRecords = []
    var fileNotFound = false
    return {
        dataDependencies: getDataDependencies(),
        putPosition: putPosition,
        getPositions: getPositions,
        getAvailableBalance: getAvailableBalance,
        getMarketRate: getMarketRate,
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
                if(fileNotFound){
                    callBackFunction(global.DEFAULT_FAIL_RESPONSE, "File not found.")
                }else{
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
        return {
            assetA: 0,
            assetB: 1
        }
    }

    function getMarketRate() {
        return 4000
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
        callBackFunction(position)
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
