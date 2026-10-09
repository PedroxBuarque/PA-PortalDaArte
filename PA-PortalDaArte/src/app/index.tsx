import { Redirect } from "expo-router";
import React from "react";

export default function IndexScreen() {
  return <Redirect href={"/pages/login/login" as any} />;
}
