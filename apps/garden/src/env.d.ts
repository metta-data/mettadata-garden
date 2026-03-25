/// <reference path="../.astro/types.d.ts" />

import type { ResolvedUser } from "@mettadata/content-model";

declare namespace App {
  interface Locals {
    user: ResolvedUser | null;
    gardenDomain?: import("./lib/gardens").GardenRow;
  }
}
