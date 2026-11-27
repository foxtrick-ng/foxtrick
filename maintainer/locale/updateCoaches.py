#!/usr/bin/env python

from __future__ import print_function
from Hattrick.CHPP import Client

import xml.etree.ElementTree as ET
import json
import os
import sys
import codecs

def init():
    if os.environ.get('GITHUB_ACTIONS'):
        CONSUMER_KEY = os.environ.get('CHPP_CONSUMER_KEY')
        CONSUMER_SECRET = os.environ.get('CHPP_CONSUMER_SECRET')
        ACCESS_TOKEN_KEY = os.environ.get('CHPP_ACCESS_TOKEN_KEY')
        ACCESS_TOKEN_SECRET = os.environ.get('CHPP_ACCESS_TOKEN_SECRET')
    else:
        from Hattrick.CHPP import Credentials
        from Hattrick.CHPP import AccessToken
        CONSUMER_KEY = Credentials.KEY
        CONSUMER_SECRET = Credentials.SECRET
        ACCESS_TOKEN_KEY = AccessToken.KEY
        ACCESS_TOKEN_SECRET = AccessToken.SECRET

    global chpp
    chpp = Client.ChppClient(CONSUMER_KEY, CONSUMER_SECRET)
    chpp.setAccessToken((ACCESS_TOKEN_KEY, ACCESS_TOKEN_SECRET))
    session = chpp.getSession()

def getCoaches(id):
    # no get started
    response = chpp.getFile('nationalteams',
                            params={'version': '1.5', 'LeagueOfficeTypeID': id})
    dom = ET.fromstring(response.content)

    teams = []
    iTeams = dom.iter("NationalTeam")
    for iTeam in iTeams:
        team = {}
        team['TeamId'] = int(iTeam.find('NationalTeamID').text)
        team['LeagueId'] = int(iTeam.find('LeagueId').text)
        team['TeamName'] = iTeam.find('NationalTeamName').text
        teams.append(team)

    coaches = []
    assistants = []

    for t in teams:
        response = chpp.getFile('nationalteamdetails',
                                params={'version': '2.0', 'teamID': t['TeamId']})
        dom = ET.fromstring(response.content)
        for iCoach in dom.iter("NationalCoach"):
            addStaff(coaches, t, iCoach, 'NationalCoachUserID', 'NationalCoachLoginname')
        for iAssistant in dom.iter("AssistantCoach"):
            addStaff(assistants, t, iAssistant, 'UserID', 'Loginname')

    return coaches, assistants


def addStaff(staff, team, node, idTag, nameTag):
    # skip vacant positions (missing node or user ID 0)
    idNode = node.find(idTag)
    if idNode is None or not idNode.text or not int(idNode.text):
        return

    nameNode = node.find(nameTag)
    staff.append({
        'LeagueId': team['LeagueId'],
        'TeamId': team['TeamId'],
        'TeamName': team['TeamName'],
        'id': int(idNode.text),
        'name': nameNode.text if nameNode is not None and nameNode.text else '',
    })


def saveCoaches(coaches, filename, type_str):
    with codecs.open(filename, mode='w', encoding='utf-8') as file:
        file.write('{\n')
        file.write('\t"type": %s,\n' % json.dumps(type_str))
        file.write('\t"list": [\n')
        # json.dumps escapes quotes and backslashes in team and user names
        file.write('\t\t' + ',\n\t\t'.join(json.dumps(a, ensure_ascii=False) for a in coaches))
        file.write('\n\t]\n}')

        print(filename, 'written')


def run(cwd='.'):
    u20, u20Assistants = getCoaches(4)
    nt, ntAssistants = getCoaches(2)

    def byLeague(staff):
        return sorted(staff, key=lambda x: x["LeagueId"])

    saveCoaches(byLeague(u20), os.path.expanduser(cwd + '/u20.json'), 'u20')
    saveCoaches(byLeague(nt), os.path.expanduser(cwd + '/nt.json'), 'nt')
    saveCoaches(byLeague(u20Assistants), os.path.expanduser(cwd + '/u20-assistant.json'), 'u20-assistant')
    saveCoaches(byLeague(ntAssistants), os.path.expanduser(cwd + '/nt-assistant.json'), 'nt-assistant')


if __name__ == '__main__':
    init()
    if len(sys.argv) > 1:
        run(sys.argv[1])
    else:
        run()
