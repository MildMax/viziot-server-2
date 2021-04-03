const _ = require('lodash')
const { standardize } = require('mac-address-util')
const { TcpDataModel } = require('./tcpData.model')
const { TcpAggregatedDataModel } = require('./tcpAggregatedData.model')
const { DeviceModel } = require('../device/device.model')
const { getStartOfToday, getNow } = require('../../util/time')

module.exports = {
  getRecentDataWithinNSeconds,
  getTotalCountFromStartOfTheDay,
  getTotalSizeFromStartOfTheDay,
  getTotalCountOfRecentDataWithinNSeconds,
  getTotalSizeOfRecentDataWithinNSeconds,
  getAggregateMacAddressSizeDataByTime,
  getAggregateMacAddressSizeDataWithinNSeconds,
  getAggregateMacAddressSizeDataFromStartOfTheDay,
  getAggregateSentReceivedDataWithinNSeconds,
  getDeviceSentReceivedDataWithinNSeconds,
}

function buildSizeMacAddressData(macPacketList) {
  const macSizeMap = {}

  macPacketList.forEach((macPacket) => {
    const { size, _id } = macPacket

    const { src_mac, dst_mac } = _id

    if (!_.isNil(src_mac)) {
      if (src_mac in macSizeMap) {
        macSizeMap[src_mac] += size
      } else {
        macSizeMap[src_mac] = size
      }
    }

    if (!_.isNil(dst_mac)) {
      if (dst_mac in macSizeMap) {
        macSizeMap[dst_mac] += size
      } else {
        macSizeMap[dst_mac] = size
      }
    }

  })
  return macSizeMap
}

function convertDeviceListToMap(devices) {
  const deviceMap = {}
  _.forEach(devices, (device) => {
    const standardizedMacAddress = standardize(device['macAddress'])
    deviceMap[standardizedMacAddress] = device['name']
  })
  return deviceMap
}

function mapMacAddressToDeviceName(macSizeMap, deviceMap) {
  const results = []
  _.forEach(macSizeMap, function(size, mac) {
    const standardizedMacAddress = standardize(mac)

    const data = {
      size,
      macAddress: standardizedMacAddress,
    }
    data['name'] = ''
    if(standardizedMacAddress in deviceMap) {
      data['name'] = deviceMap[standardizedMacAddress]
    }
    results.push(data)
  })
  return results
}

async function getRecentDataWithinNSeconds(pastMS) {
  if (_.isNil(pastMS)) {
    throw Error('n is undefined')
  }
  const endMS = Date.now()
  const startMS = endMS - pastMS
  return getAggregateDataByTime(startMS, endMS)
}

async function getAggregateMacAddressSizeDataWithinNSeconds(pastMS) {
  if (_.isNil(pastMS)) {
    throw Error('n is undefined')
  }
  const endMS = Date.now()
  const startMS = endMS - pastMS
  const size = await getAggregateMacAddressSizeDataByTime(startMS, endMS)
  return {
    size,
    startMS,
    endMS,
  }
}


async function getTotalSizeOfRecentDataWithinNSeconds(pastMS) {
  if (_.isNil(pastMS)) {
    throw Error('n is undefined')
  }
  const endMS = Date.now()
  const startMS = endMS - pastMS
  const size = await getAggregateSizeDataByTime(startMS, endMS)
  return {
    size,
    startMS,
    endMS,
  }
}


async function getAggregateMacAddressSizeDataFromStartOfTheDay() {
  const endMS = Date.now()
  const startMS = getStartOfToday()
  const size = await getAggregateMacAddressSizeDataByTime(startMS, endMS)
  return {
    size,
    startMS,
    endMS,
  }
}


async function getTotalCountOfRecentDataWithinNSeconds(pastMS) {
  if (_.isNil(pastMS)) {
    throw Error('n is undefined')
  }
  const endMS = Date.now()
  const startMS = endMS - pastMS
  const count = await getAggregateCountDataByTime(startMS, endMS)
  return {
    count,
    startMS,
    endMS,
  }
}

async function getTotalCountFromStartOfTheDay() {
  const startMS = getStartOfToday()
  const endMS = getNow()

  const count = await getAggregateCountDataByTime(startMS, endMS)

  return {
    count,
    startMS,
    endMS,
  }
}


async function getTotalSizeFromStartOfTheDay() {
  const startMS = getStartOfToday()
  const endMS = getNow()

  const size = await getAggregateSizeDataByTime(startMS, endMS)

  return {
    size,
    startMS,
    endMS,
  }
}

async function getAggregateCountDataByTime(startMS, endMS) {

  const resultsFromTcpData = await TcpDataModel.aggregate([
    {
      $match: {
        timestamp: { $gte: startMS, $lte: endMS },
      },
    },
    { $group: { _id: null, count: { $sum: 1 } } },
  ])

  const resultsFromAggregatedData = await TcpAggregatedDataModel.aggregate([
    {
      $match: {
        startMS: { $gte: startMS },
        endMS: { $lte: endMS},
      },
    },
    { $group: { _id: null, count: { $sum: '$packetCount' } } },
  ])

  let count = 0

  if (resultsFromTcpData.length > 0) {
    // console.log('resultsFromTcpData: ' + resultsFromTcpData[0].count)
    count += resultsFromTcpData[0].count
  }

  if (resultsFromAggregatedData.length > 0) {
    // console.log('resultsFromAggregatedData: ' + resultsFromAggregatedData[0].count)

    count += resultsFromAggregatedData[0].count
  }
  return count
}

async function getAggregateSizeDataByTime(startMS, endMS) {

  const resultsFromTcpData = await TcpDataModel.aggregate([
    {
      $match: {
        timestamp: { $gte: startMS, $lte: endMS },
      },
    },
    { $group: { _id: null, size: { $sum: '$packet_size' } } },
  ])

  const resultsFromAggregatedData = await TcpAggregatedDataModel.aggregate([
    {
      $match: {
        startMS: { $gte: startMS },
        endMS: { $lte: endMS},
      },
    },
    { $group: { _id: null, size: { $sum: '$totalPacketSize' } } },
  ])

  let size = 0

  if (resultsFromTcpData.length > 0) {
    // console.log('resultsFromTcpData: ' + resultsFromTcpData[0].size)
    size += resultsFromTcpData[0].size
  }

  if (resultsFromAggregatedData.length > 0) {
    // console.log('resultsFromAggregatedData: ' + resultsFromAggregatedData[0].size)
    size += resultsFromAggregatedData[0].size
  }

  return size
}



async function getAggregateMacAddressSizeDataByTime(startMS, endMS) {
  const tcpDataPromise = TcpDataModel.aggregate([
    {
      $match: {
        timestamp: { $gte: startMS, $lte: endMS },
      },
    },
    { $group: { _id: { src_mac: '$src_mac', dst_mac: '$dst_mac' }, size: { $sum: '$packet_size' } } },
  ])

  const aggregateDataPromise = TcpAggregatedDataModel.aggregate([
    {
      $match: {
        startMS: { $gte: startMS },
        endMS: { $lte: endMS},
      },
    },
    { $group: { _id: { src_mac: '$src_mac', dst_mac: '$dst_mac' }, size: { $sum: '$totalPacketSize' } } },
  ])

  const devicesDataPromise = DeviceModel.find()
  // parallel promises
  const values = await Promise.all([tcpDataPromise, aggregateDataPromise, devicesDataPromise])

  const resultsFromTcpData = values[0]
  const resultsFromAggregatedData = values[1]
  const devices = values[2]
  const deviceMap = convertDeviceListToMap(devices)

  const combinedArray = resultsFromTcpData.concat(resultsFromAggregatedData)
  const resultMap = buildSizeMacAddressData(combinedArray)
  const results = mapMacAddressToDeviceName(resultMap, deviceMap)

  return results
}

// getAggregateMacAddressSizeDataByTime(Date.now() - 1000000, Date.now())

async function getAggregateDataByTime(startMS, endMS) {
  return TcpDataModel.find({
    timestamp: { $gte: startMS, $lte: endMS },
  })
}

async function getAggregateSentReceivedDataByTime(startMS, endMS) {
  const resultsFromTcpData = await TcpDataModel.aggregate([
    {
      $match: {
        timestamp: { $gte: startMS, $lte: endMS },
      },
    },
    // { $group: { _id: '$src_mac', res: { $push: ['$dst_mac', '$packet_size'] } } },
  ])

  const macAddrs = new Set();
  const devicesDataPromise = await DeviceModel.find().select('macAddress -_id');
  devicesDataPromise.forEach(entry => macAddrs.add(entry.macAddress))

  let sent = 0;
  let received = 0;
  let total = 0;

  for (let i = 0; i < resultsFromTcpData.length; ++i) {
    const packet = resultsFromTcpData[i];
    if (packet.hasOwnProperty('src_mac') && packet.hasOwnProperty('packet_size')) {
      if (macAddrs.has(packet.src_mac)) {
        sent += packet.packet_size;
        total += packet.packet_size;
      } else if (packet.hasOwnProperty('dst_mac')) {
        received += packet.packet_size;
        total += packet.packet_size;
      }
    }
  }

  return [total, received, sent];
}

async function getAggregateSentReceivedDataWithinNSeconds(pastMS) {
  const endMS = Date.now()
  const startMS = endMS - pastMS

  const size = await getAggregateSentReceivedDataByTime(startMS, endMS);

  return {
    size,
    startMS,
    endMS,
  }
}

async function getDeviceSentReceivedDataByTime(startMS, endMS) {
  const resultsFromTcpData = await TcpDataModel.aggregate([
    {
      $match: {
        timestamp: { $gte: startMS, $lte: endMS },
      },
    },
  ])

  const macAddrs = new Set();
  const devicesDataPromise = await DeviceModel.find().select('macAddress -_id');
  devicesDataPromise.forEach(entry => macAddrs.add(entry.macAddress))

  const deviceData = {};

  for (let i = 0; i < resultsFromTcpData.length; ++i) {
    const packet = resultsFromTcpData[i];
    if (packet.hasOwnProperty('src_mac') && packet.hasOwnProperty('packet_size')) {

      let sent = 0;
      let received = 0;
      let mac = "";

      if (macAddrs.has(packet.src_mac)) {
        sent = packet.packet_size;
        mac = packet.src_mac;
      } else {
        received = packet.packet_size;
        mac = packet.dst_mac;
      }

      if (deviceData.hasOwnProperty(mac)) {
        const currSent = deviceData[mac].sent;
        const currReceived = deviceData[mac].received;
        const currTotal = deviceData[mac].total;

        deviceData[mac].sent = currSent + sent;
        deviceData[mac].received = currReceived + received;
        deviceData[mac].total = currTotal + sent + received;
      } else {
        deviceData[mac] = {
          macAddress: mac,
          sent: sent,
          received: received,
          total: (sent + received),
        }
      }
    }
  }

  return deviceData;
}

async function getDeviceSentReceivedDataWithinNSeconds(pastMS) {
  const endMS = Date.now()
  const startMS = endMS - pastMS

  const deviceData = await getDeviceSentReceivedDataByTime(startMS, endMS);

  return {
    deviceData,
    startMS,
    endMS,
  }
}
