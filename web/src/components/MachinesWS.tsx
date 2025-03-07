"use client";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { getMachines } from "@/server/curdMachine";
import { Check, CircleOff, SatelliteDish } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import useWebSocket, { ReadyState } from "react-use-websocket";
import { create } from "zustand";

type State = {
  data: {
    id: string;
    timestamp: number;
    json: {
      event: string;
      data: any;
    };
  }[];
  logs: {
    machine_id: string;
    logs: string;
    timestamp: number;
  }[];
  addLogs: (id: string, logs: string) => void;
  addData: (
    id: string,
    json: {
      event: string;
      data: any;
    }
  ) => void;
};

export const useStore = create<State>((set) => ({
  data: [],
  logs: [],
  addLogs(id, logs) {
    set((state) => ({
      ...state,
      logs: [...state.logs, { machine_id: id, logs, timestamp: Date.now() }],
    }));
  },
  addData: (id, json) =>
    set((state) => ({
      ...state,
      data: [...state.data, { id, json, timestamp: Date.now() }],
    })),
}));

export function MachinesWSMain(props: {
  machines: Awaited<ReturnType<typeof getMachines>>;
}) {
  return (
    <div className="flex flex-col gap-2 mt-4">
      Machine Status
      <div className="flex flex-wrap gap-2">
        {props.machines.map((x) => (
          <MachineWS key={x.id} machine={x} />
        ))}
      </div>
    </div>
  );
}

function MachineWS({
  machine,
}: {
  machine: Awaited<ReturnType<typeof getMachines>>[0];
}) {
  const { addData, addLogs } = useStore();
  const logs = useStore((x) =>
    x.logs
      .filter((p) => p.machine_id === machine.id)
      .sort((a, b) => a.timestamp - b.timestamp)
  );
  const [sid, setSid] = useState("");

  const wsEndpoint = machine.endpoint.replace(/^http/, "ws");
  const { lastMessage, readyState } = useWebSocket(
    `${wsEndpoint}/comfyui-deploy/ws`,
    {
      shouldReconnect: () => true,
      reconnectAttempts: 20,
      reconnectInterval: 1000,
      // queryParams: {
      //   clientId: sid,
      // },
    }
  );

  const connectionStatus = {
    [ReadyState.CONNECTING]: (
      <SatelliteDish size={14} className="text-orange-500" />
    ),
    [ReadyState.OPEN]: <Check size={14} className="text-green-500" />,
    [ReadyState.CLOSING]: <CircleOff size={14} className="text-orange-500" />,
    [ReadyState.CLOSED]: <CircleOff size={14} className="text-red-500" />,
    [ReadyState.UNINSTANTIATED]: "Uninstantiated",
  }[readyState];

  const container = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!lastMessage?.data) return;

    const message = JSON.parse(lastMessage.data);
    console.log(message.event, message);

    if (message.data.sid) {
      setSid(message.data.sid);
    }

    if (message.data?.prompt_id) {
      addData(message.data.prompt_id, message);
    }

    if (message.event === "LOGS") {
      addLogs(machine.id, message.data);
    }
  }, [lastMessage]);

  useEffect(() => {
    // console.log(logs.length, container.current);
    if (container.current) {
      const scrollHeight = container.current.scrollHeight;

      container.current.scrollTo({
        top: scrollHeight,
        behavior: "smooth",
      });
    }
  }, [logs.length]);

  return (
    <Dialog>
      <DialogTrigger asChild className="">
        <Badge className="text-sm flex gap-2 font-normal" variant="outline">
          {machine.name} {connectionStatus}
        </Badge>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-full">
        <DialogHeader>
          <DialogTitle>Machine Logs</DialogTitle>
          <DialogDescription>
            You can view your run&apos;s outputs here
          </DialogDescription>
        </DialogHeader>
        <div
          ref={(ref) => {
            if (!container.current && ref) {
              const scrollHeight = ref.scrollHeight;

              ref.scrollTo({
                top: scrollHeight,
                behavior: "instant",
              });
            }
            container.current = ref;
          }}
          className="flex flex-col text-xs p-2 overflow-y-scroll max-h-[400px] whitespace-break-spaces"
        >
          {logs.map((x, i) => (
            <div key={i}>{x.logs}</div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
