#!/usr/bin/env python

from __future__ import print_function
from Hattrick.CHPP import Client

import xml.etree.ElementTree as ET
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

    teams_with_coaches = []

    for t in teams:
        response = chpp.getFile('nationalteamdetails',
                                params={'version': '1.8', 'teamID': t['TeamId']})
        dom = ET.fromstring(response.content)
        iCoaches = dom.iter("NationalCoach")
        for iCoach in iCoaches:
            t['CoachId'] = int(iCoach.find('NationalCoachUserID').text)
            t['CoachName'] = iCoach.find('NationalCoachLoginname').text
            if t['CoachId']:
                teams_with_coaches.append(t)

    return teams_with_coaches


def saveCoaches(coaches, filename, type_str):
    with codecs.open(filename, mode='w', encoding='utf-8') as file:
        file.write('{\n')
        file.write('\t"type": "%s",\n' % type_str)
        file.write('\t"list": [\n')
        file.write('\t\t' + ',\n\t\t'.join('{ "LeagueId": %d, "TeamId": %d, "TeamName": "%s", "id": %d, "name": "%s" }' % (a["LeagueId"], a["TeamId"], a["TeamName"], a["CoachId"], a["CoachName"]) for a in coaches))
        file.write('\n\t]\n}')

        print(filename, 'written')


def run(cwd='.'):
    u20 = getCoaches(4)
    nt = getCoaches(2)

    u20 = sorted(u20, key=lambda x: x["LeagueId"])
    nt = sorted(nt, key=lambda x: x["LeagueId"])

    saveCoaches(u20, os.path.expanduser(cwd + '/u20.json'), 'u20')
    saveCoaches(nt, os.path.expanduser(cwd + '/nt.json'), 'nt')


if __name__ == '__main__':
    init()
    if len(sys.argv) > 1:
        run(sys.argv[1])
    else:
        run()
