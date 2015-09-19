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

    def on_get(self, req, resp, target):
        otype = get_target_type(target)
        target_info = (target, otype, True)

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


resource = MachinaeResource()


application = falcon.API()
application.add_sink(resource.on_get, prefix="/(?P<target>.+)")
