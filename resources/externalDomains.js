'use strict';

const DOMAINS_TO_FEDERATION_MAPPING = {
    'devopsstoketalent.onmicrosoft.com': 'Azure1',
    'activefence.com': 'activeFence12-9',
    'fiverr.com': 'FiverrOkta',
    'createnyc.com': 'evokegroup',
    'inizioevoke.com': 'evokegroup',
    'minutemedia.com': 'MinuteMediaCom',
    'dbltap.com': 'MinuteMediaCom',
    'fansided.com': 'MinuteMediaCom',
    'mentalfloss.com': 'MinuteMediaCom',
    'playerstribune.com': 'MinuteMediaCom',
    'theduel.com': 'MinuteMediaCom',
    '90min.com': 'MinuteMediaCom',
    'wdc.com': 'wdc',
    'mistplay.com': 'mistplayOkta'

}

const LOCAL_DOMAIN_NAME = 'local'

module.exports = {
    DOMAINS_TO_FEDERATION_MAPPING,
    LOCAL_DOMAIN_NAME,
}
