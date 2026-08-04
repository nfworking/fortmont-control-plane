"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(50),
  slug: z.string().min(2, "Slug must be at least 2 characters").max(50),
});

type FormValues = z.infer<typeof formSchema>;

export function CreateOrganizationDialog() {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      slug: "",
    },
  });

  async function onSubmit(values: FormValues) {
    try {
      setIsLoading(true);
      await authClient.organization.create({
        name: values.name,
        slug: values.slug,
      });

      toast.success("Organization created successfully");
      reset();
      setOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to create organization");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="size-4" />
          Create Organization
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[425px] border-zinc-800 bg-black text-white">
        <DialogHeader>
          <DialogTitle>Create Organization</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Add a new organization workspace to manage your team and resources.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup className="space-y-4">
            <Field>
              <FieldLabel className="text-zinc-300">Name</FieldLabel>
              <Input
                placeholder="My Organization"
                className="border-zinc-800 bg-zinc-900/50 text-white focus-visible:ring-zinc-700"
                {...register("name")}
              />
              {errors.name && (
                <FieldError>{errors.name.message}</FieldError>
              )}
            </Field>

            <Field>
              <FieldLabel className="text-zinc-300">Slug</FieldLabel>
              <Input
                placeholder="my-org"
                className="border-zinc-800 bg-zinc-900/50 text-white focus-visible:ring-zinc-700"
                {...register("slug")}
              />
              {errors.slug && (
                <FieldError>{errors.slug.message}</FieldError>
              )}
            </Field>
          </FieldGroup>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="border-zinc-800 bg-transparent text-white hover:bg-zinc-900 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              disabled={isLoading}
              type="submit"
              className="bg-white text-black hover:bg-zinc-200"
            >
              {isLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Create"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}