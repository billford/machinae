import os
from collections import OrderedDict

import falcon
import stopit

from machinae import get_target_type, outputs, utils
from machinae import ErrorResult, ResultSet, SiteResults
from machinae.sites import Site


MACHINAE_CONFIG = os.environ.get("MACHINAE_WEB_CONFIG", "machinae.web.yml")


class MachinaeResource:
    def __init__(self):
        with open(MACHINAE_CONFIG, "r") as f:
            self.conf = utils.safe_load(f)

        self.sites = OrderedDict([(k, v) for (k, v) in self.conf.items()])

    @property
    def results(self):
        for target_info in self.targets:
            (target, otype, _) = target_info

            target_results = list()
            for (site_name, site_conf) in self.sites.items():
                if otype.lower() not in map(lambda x: x.lower(), site_conf["otypes"]):
                    continue

                scraper = Site.from_conf(site_conf, verbose=self.verbose)

                try:
                    with stopit.SignalTimeout(15, swallow_exc=False):
                        run_results = scraper.run(target)
                except stopit.TimeoutException as e:
                    target_results.append(ErrorResult(target_info, site_conf, "Timeout"))
                except Exception as e:
                    target_results.append(ErrorResult(target_info, site_conf, e))
                else:
                    target_results.append(SiteResults(site_conf, run_results))

            yield ResultSet(target_info, target_results)

    def on_get(self, req, resp, target, otype=None):
        if otype is None:
            otype = get_target_type(target)
            otype_detected = True
        else:
            otype_detected = False
        target_info = (target, otype, otype_detected)

        target_results = list()
        for (site_name, site_conf) in self.sites.items():
            if otype.lower() not in map(lambda x: x.lower(), site_conf["otypes"]):
                continue

            scraper = Site.from_conf(site_conf)

            try:
                with stopit.SignalTimeout(15, swallow_exc=False):
                    run_results = scraper.run(target)
            except stopit.TimeoutException as e:
                target_results.append(ErrorResult(target_info, site_conf, "Timeout"))
            except Exception as e:
                target_results.append(ErrorResult(target_info, site_conf, e))
            else:
                target_results.append(SiteResults(site_conf, run_results))

        results = [ResultSet(target_info, target_results)]

        output = outputs.JsonOutput().run(results)

        resp.status = falcon.HTTP_200
        resp.body = output


api = falcon.API()
api.add_route("/{otype}/{target}", MachinaeResource())
api.add_route("/{target}", MachinaeResource())
